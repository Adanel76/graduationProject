from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, extract, func
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db
from ..metricbot import build_metricbot_assistant

router = APIRouter(prefix="/analytics", tags=["analytics"])

ACTIVE_SEAT_STATUSES = {"pending", "confirmed", "completed"}
REVENUE_STATUSES = {"confirmed", "completed"}
WEEKDAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
ONLINE_WINDOW_SECONDS = 90


def _float(value) -> float:
    return float(value or 0)


def _int(value) -> int:
    return int(value or 0)


def _percent(part: float, total: float) -> float:
    return round((part / total) * 100, 1) if total else 0


def _delta_percent(current: float, previous: float) -> float:
    if not previous:
        return 100.0 if current else 0.0
    return round(((current - previous) / previous) * 100, 1)


def apply_booking_filters(
    query,
    start_date: date,
    end_date: date,
    country: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    tour_id: Optional[int] = None,
):
    query = query.filter(func.date(models.Booking.booking_date) >= start_date)
    query = query.filter(func.date(models.Booking.booking_date) <= end_date)

    if country:
        query = query.filter(models.Tour.country == country)
    if city:
        query = query.filter(models.Tour.city == city)
    if status:
        query = query.filter(models.Booking.status == status)
    if tour_id:
        query = query.filter(models.Booking.tour_id == tour_id)

    return query


def apply_tour_filters(query, country: Optional[str] = None, city: Optional[str] = None, tour_id: Optional[int] = None):
    if country:
        query = query.filter(models.Tour.country == country)
    if city:
        query = query.filter(models.Tour.city == city)
    if tour_id:
        query = query.filter(models.Tour.id == tour_id)
    return query


def build_booking_base(db: Session, start_date: date, end_date: date, country=None, city=None, status=None, tour_id=None):
    query = db.query(models.Booking).join(models.Tour, models.Booking.tour_id == models.Tour.id)
    return apply_booking_filters(query, start_date, end_date, country, city, status, tour_id)


def get_period_totals(db: Session, start_date: date, end_date: date, country=None, city=None, status=None, tour_id=None):
    base = build_booking_base(db, start_date, end_date, country, city, status, tour_id)
    revenue_query = base.filter(models.Booking.status.in_(list(REVENUE_STATUSES)))
    revenue = _float(revenue_query.with_entities(func.coalesce(func.sum(models.Booking.total_price), 0)).scalar())
    bookings = base.count()
    cancelled = base.filter(models.Booking.status == "cancelled").count()
    paid_count = revenue_query.count()
    return {
        "bookings": bookings,
        "revenue": revenue,
        "cancelled": cancelled,
        "average_check": round(revenue / paid_count, 2) if paid_count else 0,
    }


def _build_ml_assistant_legacy(db: Session, end_date: date, country=None, city=None, status=None, tour_id=None):
    """Train a lightweight regression model on booking history and return metric-bot insights.

    The model is intentionally local and transparent: it learns a ridge regression over
    daily demand features, weekday seasonality and lag metrics. It does not call any
    external API and can be trained on the user's PC as the database grows.
    """
    history_days = 180
    train_start = end_date - timedelta(days=history_days - 1)

    daily_query = (
        db.query(
            func.date(models.Booking.booking_date).label("date"),
            func.count(models.Booking.id).label("bookings"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
        )
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    daily_query = apply_booking_filters(daily_query, train_start, end_date, country, city, status, tour_id)
    raw_rows = daily_query.group_by(func.date(models.Booking.booking_date)).order_by(func.date(models.Booking.booking_date)).all()

    lookup = {str(row.date): {"bookings": _float(row.bookings), "revenue": _float(row.revenue)} for row in raw_rows}
    rows = []
    for offset in range(history_days):
        current_date = train_start + timedelta(days=offset)
        value = lookup.get(str(current_date), {"bookings": 0.0, "revenue": 0.0})
        rows.append({"date": current_date, "bookings": value["bookings"], "revenue": value["revenue"]})

    active_rows = [row for row in rows if row["bookings"] or row["revenue"]]
    if len(active_rows) < 7:
        return schemas.AnalyticsMlAssistant(
            status="not_enough_data",
            training_samples=len(active_rows),
            confidence=0,
            risk_level="unknown",
            summary="ML-ассистенту пока недостаточно истории для обучения. Нужны хотя бы 7 дней с заявками или выручкой.",
            recommendations=[
                "Продолжайте накапливать заявки и оплаты в системе.",
                "После появления истории за несколько недель модель начнёт прогнозировать спрос и выручку.",
            ],
        )

    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error
    except Exception:
        RandomForestRegressor = None
        mean_absolute_error = None

    try:
        import numpy as np
    except Exception:
        np = None

    model_label = "MetricBot RandomForest" if RandomForestRegressor is not None else "MetricBot Ridge"

    def lag_value(index, key, lag):
        prev_index = index - lag
        if 0 <= prev_index < len(rows):
            return float(rows[prev_index].get(key) or 0.0)
        return 0.0

    def rolling_value(index, key, window=7):
        # During forecast generation index can be greater than the actual history length.
        # Use the last available historical window instead of reading outside the list.
        end = min(index, len(rows))
        start = max(0, end - window)
        values = [float(rows[i].get(key) or 0.0) for i in range(start, end)]
        return sum(values) / len(values) if values else 0.0

    def features_for(index, current_date, key):
        weekday = current_date.weekday()
        day_index = index / max(1, len(rows))
        return [
            1.0,
            day_index,
            1.0 if weekday >= 5 else 0.0,
            weekday / 6.0,
            lag_value(index, key, 1),
            lag_value(index, key, 7),
            rolling_value(index, key, 7),
        ]

    def fit_predict(key):
        train_indices = [i for i, row in enumerate(rows) if i >= 7 and (row["bookings"] or row["revenue"])]
        if len(train_indices) < 7:
            train_indices = list(range(7, len(rows)))
        if len(train_indices) < 7:
            return [0.0] * 7, 0.25

        x = [features_for(i, rows[i]["date"], key) for i in train_indices]
        y = [rows[i][key] for i in train_indices]

        if RandomForestRegressor is not None and np is not None:
            x_arr = np.array(x, dtype=float)
            y_arr = np.array(y, dtype=float)

            model = RandomForestRegressor(
                n_estimators=220,
                random_state=42,
                min_samples_leaf=2,
                max_depth=8,
            )
            model.fit(x_arr, y_arr)

            y_hat = model.predict(x_arr)
            mae = float(mean_absolute_error(y_arr, y_hat)) if len(y_arr) else 0.0
            scale = float(np.mean(np.abs(y_arr))) or 1.0
            confidence = max(0.2, min(0.94, 1 - mae / (scale + 1)))

            forecast = []
            for step in range(1, 8):
                forecast_date = end_date + timedelta(days=step)
                idx = len(rows) + step - 1
                feature = np.array([features_for(idx, forecast_date, key)], dtype=float)
                value = max(0.0, float(model.predict(feature)[0]))
                forecast.append(value)

            try:
                import joblib
                models_dir = Path(__file__).resolve().parents[2] / "storage" / "ml_models"
                models_dir.mkdir(parents=True, exist_ok=True)
                joblib.dump(model, models_dir / f"metricbot_{key}.joblib")
            except Exception:
                pass

            return forecast, confidence

        if np is not None:
            x_arr = np.array(x, dtype=float)
            y_arr = np.array(y, dtype=float)
            ridge = 0.35
            identity = np.eye(x_arr.shape[1])
            identity[0, 0] = 0
            weights = np.linalg.solve(x_arr.T @ x_arr + ridge * identity, x_arr.T @ y_arr)

            y_hat = x_arr @ weights
            mae = float(np.mean(np.abs(y_hat - y_arr))) if len(y_arr) else 0.0
            scale = float(np.mean(np.abs(y_arr))) or 1.0
            confidence = max(0.15, min(0.92, 1 - mae / (scale + 1)))

            forecast = []
            mutable_rows = [dict(row) for row in rows]
            for step in range(1, 8):
                forecast_date = end_date + timedelta(days=step)
                idx = len(mutable_rows)
                feature = np.array(features_for(idx, forecast_date, key), dtype=float)
                value = max(0.0, float(feature @ weights))
                forecast.append(value)
                mutable_rows.append({"date": forecast_date, "bookings": 0.0, "revenue": 0.0, key: value})
            return forecast, confidence

        # Fallback without numpy: weighted moving average with weekday awareness.
        recent = [row[key] for row in rows[-14:]]
        recent_average = sum(recent) / len(recent) if recent else 0.0
        weekday_average = {}
        for row in rows[-56:]:
            weekday_average.setdefault(row["date"].weekday(), []).append(row[key])
        forecast = []
        for step in range(1, 8):
            wd_values = weekday_average.get((end_date + timedelta(days=step)).weekday(), [])
            wd_avg = sum(wd_values) / len(wd_values) if wd_values else recent_average
            forecast.append(max(0.0, 0.65 * recent_average + 0.35 * wd_avg))
        return forecast, 0.45

    booking_forecast, booking_confidence = fit_predict("bookings")
    revenue_forecast, revenue_confidence = fit_predict("revenue")
    confidence = round(((booking_confidence + revenue_confidence) / 2) * 100, 1)

    forecast_points = [
        schemas.AnalyticsMlForecastPoint(
            date=str(end_date + timedelta(days=step)),
            bookings=round(booking_forecast[step - 1], 1),
            revenue=round(revenue_forecast[step - 1], 2),
        )
        for step in range(1, 8)
    ]

    last_7_bookings = sum(row["bookings"] for row in rows[-7:])
    prev_7_bookings = sum(row["bookings"] for row in rows[-14:-7])
    last_7_revenue = sum(row["revenue"] for row in rows[-7:])
    prev_7_revenue = sum(row["revenue"] for row in rows[-14:-7])
    bookings_delta = _delta_percent(last_7_bookings, prev_7_bookings)
    revenue_delta = _delta_percent(last_7_revenue, prev_7_revenue)
    expected_bookings = sum(booking_forecast)
    expected_revenue = sum(revenue_forecast)
    average_recent_bookings = last_7_bookings / 7 if last_7_bookings else 0
    expected_daily_bookings = expected_bookings / 7 if expected_bookings else 0
    forecast_vs_recent = _delta_percent(expected_daily_bookings, average_recent_bookings)

    recent_window_start = end_date - timedelta(days=13)
    recent_bookings_query = build_booking_base(db, recent_window_start, end_date, country, city, status, tour_id)
    recent_total = recent_bookings_query.count()
    recent_cancelled = recent_bookings_query.filter(models.Booking.status == "cancelled").count()
    recent_pending = recent_bookings_query.filter(models.Booking.status == "pending").count()
    recent_cancellation_rate = _percent(recent_cancelled, recent_total)
    recent_pending_rate = _percent(recent_pending, recent_total)

    risk_level = "low"
    if bookings_delta < -20 or revenue_delta < -20 or recent_cancellation_rate >= 25:
        risk_level = "high"
    elif bookings_delta < -8 or revenue_delta < -8 or recent_pending_rate >= 35 or forecast_vs_recent < -10:
        risk_level = "medium"

    signals = [
        schemas.AnalyticsInsightItem(
            tone="danger" if bookings_delta < -20 else "warning" if bookings_delta < -8 else "good",
            title="Динамика спроса",
            value=f"{bookings_delta:+.1f}%",
            text="Сравнение заявок за последние 7 дней с предыдущей неделей.",
        ),
        schemas.AnalyticsInsightItem(
            tone="danger" if revenue_delta < -20 else "warning" if revenue_delta < -8 else "good",
            title="Динамика выручки",
            value=f"{revenue_delta:+.1f}%",
            text="Модель отслеживает изменение оплаченной и подтверждённой выручки.",
        ),
        schemas.AnalyticsInsightItem(
            tone="info",
            title="Прогноз заявок",
            value=str(round(expected_bookings, 1)),
            text="Ожидаемое количество заявок на ближайшие 7 дней по регрессионной модели.",
        ),
        schemas.AnalyticsInsightItem(
            tone="info",
            title="Прогноз выручки",
            value=f"{expected_revenue:,.0f} ₽".replace(",", " "),
            text="Ожидаемая выручка на ближайшие 7 дней с учетом истории спроса.",
        ),
        schemas.AnalyticsInsightItem(
            tone="danger" if recent_cancellation_rate >= 25 else "warning" if recent_cancellation_rate >= 12 else "good",
            title="Риск отмен",
            value=f"{recent_cancellation_rate:.1f}%",
            text="Доля отмен среди заявок за последние 14 дней.",
        ),
        schemas.AnalyticsInsightItem(
            tone="warning" if recent_pending_rate >= 35 else "good",
            title="Нагрузка менеджеров",
            value=f"{recent_pending_rate:.1f}%",
            text="Доля заявок в ожидании: чем выше показатель, тем быстрее нужна обработка.",
        ),
        schemas.AnalyticsInsightItem(
            tone="danger" if forecast_vs_recent < -20 else "warning" if forecast_vs_recent < -8 else "good",
            title="Прогноз к текущему темпу",
            value=f"{forecast_vs_recent:+.1f}%",
            text="Сравнение ожидаемого дневного спроса с текущей средней неделей.",
        ),
    ]

    recommendations = []
    if risk_level == "high":
        recommendations.extend([
            "Проверьте направления с падением спроса и запустите точечную акцию.",
            "Разберите отменённые заявки: причина может быть в цене, датах или условиях оплаты.",
        ])
    elif risk_level == "medium":
        recommendations.extend([
            "Проверьте цены и свободные места по турам с низкой загрузкой.",
            "Усилите видимость туров, которые чаще переходят в подтвержденные заявки.",
        ])
    else:
        recommendations.extend([
            "Сохраняйте актуальность карточек туров: фото, описание, даты, места и координаты отеля.",
            "Используйте прогноз на неделю для планирования нагрузки менеджеров.",
        ])

    if recent_pending_rate >= 25:
        recommendations.append("Назначьте ответственного за заявки в ожидании: очередь уже заметно влияет на конверсию.")
    if recent_cancellation_rate >= 12:
        recommendations.append("Соберите причины отмен за последние 14 дней и сравните их с ценой, датами и способом оплаты.")
    if confidence < 55:
        recommendations.append("Для повышения точности модели добавьте больше исторических бронирований или загрузите CSV с прошлыми продажами.")

    summary = (
        f"MetricBot обучил локальную ML-модель {model_label} на {len(active_rows)} активных днях. "
        f"Ожидается примерно {round(expected_bookings, 1)} заявок и "
        f"{expected_revenue:,.0f} ₽ выручки на ближайшую неделю."
    ).replace(",", " ")

    return schemas.AnalyticsMlAssistant(
        model_name=model_label,
        model_type="supervised_regression_random_forest" if RandomForestRegressor is not None else "supervised_regression_ridge",
        status="ready",
        training_samples=len(active_rows),
        confidence=confidence,
        risk_level=risk_level,
        summary=summary,
        forecast_next_7_days=forecast_points,
        signals=signals,
        recommendations=recommendations,
    )


def _build_ml_assistant(db: Session, end_date: date, country=None, city=None, status=None, tour_id=None):
    return build_metricbot_assistant(db, end_date, country, city, status, tour_id)


@router.get("/overview", response_model=schemas.AnalyticsOverview)
def get_analytics_overview(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "manager", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    today = date.today()
    online_threshold = datetime.utcnow() - timedelta(seconds=ONLINE_WINDOW_SECONDS)

    booking_stats = db.query(
        func.count(models.Booking.id).label("total"),
        func.sum(case((models.Booking.status == "confirmed", 1), else_=0)).label("confirmed"),
        func.sum(case((models.Booking.status == "pending", 1), else_=0)).label("pending"),
        func.sum(case((models.Booking.status == "cancelled", 1), else_=0)).label("cancelled"),
        func.sum(case((models.Booking.status == "completed", 1), else_=0)).label("completed"),
        func.coalesce(
            func.sum(
                case(
                    (models.Booking.status.in_(list(REVENUE_STATUSES)), models.Booking.total_price),
                    else_=0,
                )
            ),
            0,
        ).label("revenue"),
    ).one()

    paid_count = _int(booking_stats.confirmed) + _int(booking_stats.completed)
    total_revenue = _float(booking_stats.revenue)

    tour_stats = db.query(
        func.count(models.Tour.id).label("total"),
        func.sum(case((models.Tour.start_date >= today, 1), else_=0)).label("active"),
        func.sum(case((models.Tour.start_date < today, 1), else_=0)).label("archived"),
        func.coalesce(func.sum(models.Tour.max_people), 0).label("capacity"),
    ).one()

    reserved_seats = _int(
        db.query(func.coalesce(func.sum(models.Booking.people_count), 0))
        .filter(models.Booking.status.in_(list(ACTIVE_SEAT_STATUSES)))
        .scalar()
    )
    total_capacity = _int(tour_stats.capacity)
    review_stats = db.query(
        func.count(models.Review.id).label("total"),
        func.coalesce(func.avg(models.Review.rating), 0).label("rating"),
    ).one()
    user_stats = db.query(
        func.count(models.User.id).label("total"),
        func.sum(case((models.User.last_seen_at >= online_threshold, 1), else_=0)).label("online"),
    ).one()

    return schemas.AnalyticsOverview(
        total_users=_int(user_stats.total),
        online_users=_int(user_stats.online),
        total_tours=_int(tour_stats.total),
        active_tours=_int(tour_stats.active),
        archived_tours=_int(tour_stats.archived),
        total_bookings=_int(booking_stats.total),
        confirmed_bookings=_int(booking_stats.confirmed),
        pending_bookings=_int(booking_stats.pending),
        cancelled_bookings=_int(booking_stats.cancelled),
        completed_bookings=_int(booking_stats.completed),
        total_revenue=total_revenue,
        average_check=round(total_revenue / paid_count, 2) if paid_count else 0,
        average_rating=round(_float(review_stats.rating), 2),
        reviews_count=_int(review_stats.total),
        reserved_seats=reserved_seats,
        available_seats=max(total_capacity - reserved_seats, 0),
        occupancy_rate=_percent(reserved_seats, total_capacity),
    )


@router.get("/dashboard", response_model=schemas.AnalyticsDashboardResponse)
def get_analytics_dashboard(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    tour_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)

    if current_user.role not in ["admin", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    current_user.last_seen_at = datetime.utcnow()
    db.commit()

    today = date.today()
    if start_date is None:
        start_date = date_from
    if end_date is None:
        end_date = date_to
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = today - timedelta(days=364)

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date cannot be later than end_date")

    bookings_base = build_booking_base(db, start_date, end_date, country, city, status, tour_id)

    total_bookings = bookings_base.count()
    confirmed_bookings = bookings_base.filter(models.Booking.status == "confirmed").count()
    pending_bookings = bookings_base.filter(models.Booking.status == "pending").count()
    cancelled_bookings = bookings_base.filter(models.Booking.status == "cancelled").count()
    completed_bookings = bookings_base.filter(models.Booking.status == "completed").count()

    revenue_query = bookings_base.filter(models.Booking.status.in_(list(REVENUE_STATUSES)))
    total_revenue = _float(revenue_query.with_entities(func.coalesce(func.sum(models.Booking.total_price), 0)).scalar())
    paid_count = revenue_query.count()
    average_check = round(total_revenue / paid_count, 2) if paid_count else 0
    lost_revenue = _float(
        bookings_base.filter(models.Booking.status == "cancelled")
        .with_entities(func.coalesce(func.sum(models.Booking.total_price), 0))
        .scalar()
    )

    tours_base = apply_tour_filters(db.query(models.Tour), country=country, city=city, tour_id=tour_id)
    total_tours = tours_base.count()
    active_tours = tours_base.filter(models.Tour.start_date >= today).count()
    archived_tours = tours_base.filter(models.Tour.start_date < today).count()

    users_by_day_raw = (
        db.query(func.date(models.User.created_at).label("date"), func.count(models.User.id).label("value"))
        .filter(func.date(models.User.created_at) >= start_date)
        .filter(func.date(models.User.created_at) <= end_date)
        .group_by(func.date(models.User.created_at))
        .order_by(func.date(models.User.created_at))
        .all()
    )
    users_by_day = [schemas.AnalyticsChartPoint(date=str(item.date), value=_int(item.value)) for item in users_by_day_raw]

    total_users = db.query(models.User).count()
    online_threshold = datetime.utcnow() - timedelta(seconds=ONLINE_WINDOW_SECONDS)
    online_users = db.query(models.User).filter(models.User.last_seen_at >= online_threshold).count()

    bookings_by_day_query = (
        db.query(func.date(models.Booking.booking_date).label("date"), func.count(models.Booking.id).label("value"))
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    bookings_by_day_query = apply_booking_filters(bookings_by_day_query, start_date, end_date, country, city, status, tour_id)
    bookings_by_day_raw = (
        bookings_by_day_query.group_by(func.date(models.Booking.booking_date)).order_by(func.date(models.Booking.booking_date)).all()
    )
    bookings_by_day = [schemas.AnalyticsChartPoint(date=str(item.date), value=_int(item.value)) for item in bookings_by_day_raw]

    revenue_by_day_query = (
        db.query(func.date(models.Booking.booking_date).label("date"), func.coalesce(func.sum(models.Booking.total_price), 0).label("value"))
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
        .filter(models.Booking.status.in_(list(REVENUE_STATUSES)))
    )
    revenue_by_day_query = apply_booking_filters(revenue_by_day_query, start_date, end_date, country, city, None, tour_id)
    revenue_by_day_raw = revenue_by_day_query.group_by(func.date(models.Booking.booking_date)).order_by(func.date(models.Booking.booking_date)).all()
    revenue_by_day = [schemas.AnalyticsMoneyPoint(date=str(item.date), value=_float(item.value)) for item in revenue_by_day_raw]

    booking_statuses_raw = (
        db.query(models.Booking.status.label("status"), func.count(models.Booking.id).label("count"))
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    booking_statuses_raw = apply_booking_filters(booking_statuses_raw, start_date, end_date, country, city, None, tour_id)
    booking_statuses_raw = booking_statuses_raw.group_by(models.Booking.status).all()
    booking_statuses = [schemas.AnalyticsStatusItem(status=item.status or "unknown", count=_int(item.count)) for item in booking_statuses_raw]

    def build_dimension(group_column):
        query = (
            db.query(
                group_column.label("name"),
                func.count(models.Booking.id).label("value"),
                func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
            )
            .join(models.Tour, models.Booking.tour_id == models.Tour.id)
        )
        query = apply_booking_filters(query, start_date, end_date, country, city, status, tour_id)
        return [
            schemas.AnalyticsDimensionItem(name=item.name or "Не указано", value=_int(item.value), revenue=_float(item.revenue))
            for item in query.group_by(group_column).order_by(func.count(models.Booking.id).desc()).limit(10).all()
        ]

    bookings_by_country = build_dimension(models.Tour.country)
    bookings_by_city = build_dimension(models.Tour.city)

    top_tours_query = (
        db.query(
            models.Tour.id.label("tour_id"),
            models.Tour.title.label("title"),
            func.count(models.Booking.id).label("bookings_count"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
        )
        .join(models.Booking, models.Booking.tour_id == models.Tour.id)
    )
    top_tours_query = apply_booking_filters(top_tours_query, start_date, end_date, country, city, status, tour_id)
    top_tours_raw = (
        top_tours_query.group_by(models.Tour.id, models.Tour.title)
        .order_by(func.count(models.Booking.id).desc(), func.sum(models.Booking.total_price).desc())
        .limit(10)
        .all()
    )
    top_tours = [
        schemas.AnalyticsTopTourItem(
            tour_id=_int(item.tour_id),
            title=item.title,
            bookings_count=_int(item.bookings_count),
            revenue=_float(item.revenue),
        )
        for item in top_tours_raw
    ]

    average_rating_query = db.query(func.coalesce(func.avg(models.Review.rating), 0)).join(models.Tour, models.Review.tour_id == models.Tour.id)
    average_rating_query = apply_tour_filters(average_rating_query, country=country, city=city, tour_id=tour_id)
    average_rating = _float(average_rating_query.scalar())

    quality_tours = tours_base.all()
    zero_capacity_tours = sum(1 for tour in quality_tours if not _int(tour.max_people))
    missing_images = sum(1 for tour in quality_tours if not tour.image_url and not tour.image_data)
    missing_descriptions = sum(1 for tour in quality_tours if not tour.description)
    missing_hotel_coordinates = sum(1 for tour in quality_tours if not tour.hotel_map_lat or not tour.hotel_map_lng)

    capacity_tours = tours_base.order_by(models.Tour.start_date.asc(), models.Tour.id.desc()).limit(20).all()
    capacity_by_tour = []
    total_max_people = 0
    total_reserved_seats = 0

    for tour in capacity_tours:
        reserved = _int(
            db.query(func.coalesce(func.sum(models.Booking.people_count), 0))
            .filter(models.Booking.tour_id == tour.id)
            .filter(models.Booking.status.in_(list(ACTIVE_SEAT_STATUSES)))
            .scalar()
        )
        max_people = _int(tour.max_people)
        available = max(max_people - reserved, 0)
        occupancy_rate = round((reserved / max_people) * 100, 1) if max_people else 0
        total_max_people += max_people
        total_reserved_seats += reserved
        capacity_by_tour.append(
            schemas.AnalyticsTourCapacityItem(
                tour_id=tour.id,
                title=tour.title,
                max_people=max_people,
                reserved_seats=reserved,
                available_seats=available,
                occupancy_rate=occupancy_rate,
            )
        )

    total_available_seats = max(total_max_people - total_reserved_seats, 0)
    occupancy_rate = round((total_reserved_seats / total_max_people) * 100, 1) if total_max_people else 0

    overview = schemas.AnalyticsOverview(
        total_users=total_users,
        online_users=online_users,
        total_tours=total_tours,
        active_tours=active_tours,
        archived_tours=archived_tours,
        total_bookings=total_bookings,
        confirmed_bookings=confirmed_bookings,
        pending_bookings=pending_bookings,
        cancelled_bookings=cancelled_bookings,
        completed_bookings=completed_bookings,
        total_revenue=total_revenue,
        average_check=average_check,
        average_rating=average_rating,
        reserved_seats=total_reserved_seats,
        available_seats=total_available_seats,
        occupancy_rate=occupancy_rate,
    )

    # Дополнительные срезы для глубокой аналитики.
    payment_statuses_raw = (
        db.query(
            func.coalesce(models.Booking.payment_status, "unknown").label("name"),
            func.count(models.Booking.id).label("value"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
        )
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    payment_statuses_raw = apply_booking_filters(payment_statuses_raw, start_date, end_date, country, city, status, tour_id)
    payment_statuses = [
        schemas.AnalyticsBreakdownItem(
            name=item.name or "Не указано",
            value=_int(item.value),
            revenue=_float(item.revenue),
            rate=_percent(_int(item.value), total_bookings),
        )
        for item in payment_statuses_raw.group_by(models.Booking.payment_status).order_by(func.count(models.Booking.id).desc()).all()
    ]

    payment_methods_raw = (
        db.query(
            func.coalesce(models.Booking.payment_method, "Не указан").label("name"),
            func.count(models.Booking.id).label("value"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
        )
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    payment_methods_raw = apply_booking_filters(payment_methods_raw, start_date, end_date, country, city, status, tour_id)
    payment_methods = [
        schemas.AnalyticsBreakdownItem(
            name=item.name or "Не указан",
            value=_int(item.value),
            revenue=_float(item.revenue),
            rate=_percent(_int(item.value), total_bookings),
        )
        for item in payment_methods_raw.group_by(models.Booking.payment_method).order_by(func.count(models.Booking.id).desc()).all()
    ]

    weekday_expr = extract("dow", models.Booking.booking_date)
    weekday_raw = (
        db.query(
            weekday_expr.label("weekday"),
            func.count(models.Booking.id).label("value"),
            func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"),
        )
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    weekday_raw = apply_booking_filters(weekday_raw, start_date, end_date, country, city, status, tour_id)
    weekday_lookup = {
        str(int(item.weekday or 0)): schemas.AnalyticsBreakdownItem(
            name=WEEKDAY_LABELS[int(item.weekday or 0)],
            value=_int(item.value),
            revenue=_float(item.revenue),
            rate=_percent(_int(item.value), total_bookings),
        )
        for item in weekday_raw.group_by(weekday_expr).all()
    }
    weekday_demand = [weekday_lookup.get(str(i), schemas.AnalyticsBreakdownItem(name=WEEKDAY_LABELS[i], value=0, revenue=0, rate=0)) for i in range(7)]

    price_segment_expr = case(
        (models.Tour.price < 50000, "до 50 000 ₽"),
        (models.Tour.price < 100000, "50 000–100 000 ₽"),
        (models.Tour.price < 150000, "100 000–150 000 ₽"),
        else_="от 150 000 ₽",
    )
    price_raw = (
        db.query(price_segment_expr.label("name"), func.count(models.Booking.id).label("value"), func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"))
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    price_raw = apply_booking_filters(price_raw, start_date, end_date, country, city, status, tour_id)
    price_segments = [
        schemas.AnalyticsBreakdownItem(name=item.name, value=_int(item.value), revenue=_float(item.revenue), rate=_percent(_int(item.value), total_bookings))
        for item in price_raw.group_by(price_segment_expr).all()
    ]

    duration_segment_expr = case(
        (models.Tour.duration <= 3, "1–3 дня"),
        (models.Tour.duration <= 7, "4–7 дней"),
        (models.Tour.duration <= 14, "8–14 дней"),
        else_="15+ дней",
    )
    duration_raw = (
        db.query(duration_segment_expr.label("name"), func.count(models.Booking.id).label("value"), func.coalesce(func.sum(models.Booking.total_price), 0).label("revenue"))
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    duration_raw = apply_booking_filters(duration_raw, start_date, end_date, country, city, status, tour_id)
    duration_segments = [
        schemas.AnalyticsBreakdownItem(name=item.name, value=_int(item.value), revenue=_float(item.revenue), rate=_percent(_int(item.value), total_bookings))
        for item in duration_raw.group_by(duration_segment_expr).all()
    ]

    conversion_funnel = [
        schemas.AnalyticsFunnelStep(name="Пользователи", value=total_users, rate=100 if total_users else 0),
        schemas.AnalyticsFunnelStep(name="Заявки", value=total_bookings, rate=_percent(total_bookings, total_users)),
        schemas.AnalyticsFunnelStep(name="Подтверждено", value=confirmed_bookings + completed_bookings, rate=_percent(confirmed_bookings + completed_bookings, total_bookings)),
        schemas.AnalyticsFunnelStep(name="Завершено", value=completed_bookings, rate=_percent(completed_bookings, total_bookings)),
    ]

    period_days = (end_date - start_date).days + 1
    previous_end_date = start_date - timedelta(days=1)
    previous_start_date = previous_end_date - timedelta(days=period_days - 1)
    current_totals = get_period_totals(db, start_date, end_date, country, city, status, tour_id)
    previous_totals = get_period_totals(db, previous_start_date, previous_end_date, country, city, status, tour_id)
    period_comparison = schemas.AnalyticsPeriodComparison(
        previous_start_date=str(previous_start_date),
        previous_end_date=str(previous_end_date),
        bookings_delta_percent=_delta_percent(current_totals["bookings"], previous_totals["bookings"]),
        revenue_delta_percent=_delta_percent(current_totals["revenue"], previous_totals["revenue"]),
        cancelled_delta_percent=_delta_percent(current_totals["cancelled"], previous_totals["cancelled"]),
        average_check_delta_percent=_delta_percent(current_totals["average_check"], previous_totals["average_check"]),
    )

    cancellation_rate = _percent(cancelled_bookings, total_bookings)
    confirmation_rate = _percent(confirmed_bookings + completed_bookings, total_bookings)
    average_daily_revenue = round(total_revenue / period_days, 2) if period_days else 0
    pending_share = _percent(pending_bookings, total_bookings)

    data_quality = [
        schemas.AnalyticsDataQualityMetric(
            name="Туры без изображения",
            value=missing_images,
            severity="warning" if missing_images else "ok",
            description="Карточки без фото хуже воспринимаются клиентами.",
        ),
        schemas.AnalyticsDataQualityMetric(
            name="Туры без описания",
            value=missing_descriptions,
            severity="warning" if missing_descriptions else "ok",
            description="Описание нужно для принятия решения клиентом.",
        ),
        schemas.AnalyticsDataQualityMetric(
            name="Нет координат отеля",
            value=missing_hotel_coordinates,
            severity="warning" if missing_hotel_coordinates else "ok",
            description="Координаты нужны для карты в карточке тура.",
        ),
        schemas.AnalyticsDataQualityMetric(
            name="Туры без вместимости",
            value=zero_capacity_tours,
            severity="danger" if zero_capacity_tours else "ok",
            description="Без вместимости нельзя корректно считать свободные места.",
        ),
    ]

    analyst_insights = [
        schemas.AnalyticsInsightItem(
            tone="danger" if cancellation_rate >= 20 else "warning" if cancellation_rate >= 10 else "good",
            title="Доля отмен",
            value=f"{cancellation_rate:.1f}%",
            text=f"Потерянная выручка по отменённым заявкам: {lost_revenue:,.0f} ₽".replace(",", " "),
        ),
        schemas.AnalyticsInsightItem(
            tone="good" if confirmation_rate >= 60 else "warning",
            title="Конверсия заявок в подтверждение",
            value=f"{confirmation_rate:.1f}%",
            text="Показывает, какая часть заявок доходит до подтверждения или завершения.",
        ),
        schemas.AnalyticsInsightItem(
            tone="info",
            title="Средняя выручка в день",
            value=f"{average_daily_revenue:,.0f} ₽".replace(",", " "),
            text="Можно использовать для оперативного сравнения периодов и план-факт контроля.",
        ),
        schemas.AnalyticsInsightItem(
            tone="warning" if pending_share >= 35 else "good",
            title="Заявки в ожидании",
            value=f"{pending_share:.1f}%",
            text="Высокая доля ожидания означает, что менеджеру нужно быстрее обработать заявки.",
        ),
    ]

    return schemas.AnalyticsDashboardResponse(
        overview=overview,
        users_by_day=users_by_day,
        bookings_by_day=bookings_by_day,
        revenue_by_day=revenue_by_day,
        booking_statuses=booking_statuses,
        bookings_by_country=bookings_by_country,
        bookings_by_city=bookings_by_city,
        top_tours=top_tours,
        capacity_by_tour=capacity_by_tour,
        payment_statuses=payment_statuses,
        payment_methods=payment_methods,
        weekday_demand=weekday_demand,
        price_segments=price_segments,
        duration_segments=duration_segments,
        conversion_funnel=conversion_funnel,
        analyst_insights=analyst_insights,
        period_comparison=period_comparison,
        data_quality=data_quality,
        ml_assistant=_build_ml_assistant(db, end_date, country, city, status, tour_id),
    )

@router.post("/ml-assistant/train", response_model=schemas.AnalyticsMlAssistant)
def train_ml_assistant(
    end_date: Optional[date] = Query(default=None),
    country: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    tour_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "analyst"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    current_user.last_seen_at = datetime.utcnow()
    db.commit()

    return _build_ml_assistant(db, end_date or date.today(), country, city, status, tour_id)
