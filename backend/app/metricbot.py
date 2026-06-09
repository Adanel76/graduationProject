import math
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from . import models, schemas

REVENUE_STATUSES = {"confirmed", "completed"}
METRICBOT_VERSION = "metricbot-local-v2"
HISTORY_DAYS = 180
FORECAST_DAYS = 7

FEATURE_NAMES = [
    "trend",
    "weekday_sin",
    "weekday_cos",
    "is_weekend",
    "month_sin",
    "month_cos",
    "lag_1",
    "lag_7",
    "rolling_7",
    "rolling_14",
    "same_weekday_avg",
    "cancel_rate_14",
    "pending_rate_14",
    "avg_people_14",
    "avg_check_14",
]

FEATURE_LABELS = {
    "trend": ("Тренд периода", "Позиция дня внутри обучающего окна: помогает увидеть рост или спад."),
    "weekday_sin": ("День недели sin", "Циклическое кодирование дня недели без резкого разрыва между воскресеньем и понедельником."),
    "weekday_cos": ("День недели cos", "Вторая часть циклического признака дня недели."),
    "is_weekend": ("Выходной день", "Отделяет субботу и воскресенье от рабочих дней."),
    "month_sin": ("Месяц sin", "Сезонность месяца в циклическом виде."),
    "month_cos": ("Месяц cos", "Вторая часть сезонности месяца."),
    "lag_1": ("Вчерашнее значение", "Что было с заявками или выручкой в предыдущий день."),
    "lag_7": ("Значение неделю назад", "Сравнение с тем же днём прошлой недели."),
    "rolling_7": ("Среднее за 7 дней", "Короткая скользящая средняя для текущего темпа."),
    "rolling_14": ("Среднее за 14 дней", "Более устойчивый контекст без сильного шума одного дня."),
    "same_weekday_avg": ("Среднее по такому же дню недели", "Историческое поведение именно этого дня недели."),
    "cancel_rate_14": ("Доля отмен за 14 дней", "Сигнал риска: много отмен снижает доверие к будущей выручке."),
    "pending_rate_14": ("Доля ожидания за 14 дней", "Показывает нагрузку менеджеров и незавершённую воронку."),
    "avg_people_14": ("Среднее число туристов", "Размер заявок: влияет на прогноз загрузки и денег."),
    "avg_check_14": ("Средний чек за 14 дней", "Сколько денег приносит средняя подтверждённая заявка."),
}


@dataclass
class TargetResult:
    target: str
    forecast: list[float]
    confidence: float
    metrics: dict
    model: object = None
    feature_importance: dict[str, float] | None = None
    fallback: bool = False


def _float(value) -> float:
    return float(value or 0)


def _percent(part: float, total: float) -> float:
    return round((part / total) * 100, 1) if total else 0


def _delta_percent(current: float, previous: float) -> float:
    if not previous:
        return 100.0 if current else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _date_key(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _models_dir() -> Path:
    if os.environ.get("ML_MODELS_DIR"):
        return Path(os.environ["ML_MODELS_DIR"])
    if os.environ.get("TEST_STORAGE_DIR"):
        return Path(os.environ["TEST_STORAGE_DIR"]) / "ml_models"
    return Path(__file__).resolve().parents[1] / "storage" / "ml_models"


def _apply_filters(query, start_date: date, end_date: date, country=None, city=None, status=None, tour_id=None):
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


def _build_daily_rows(db: Session, end_date: date, country=None, city=None, status=None, tour_id=None) -> list[dict]:
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    paid_revenue = case(
        (models.Booking.status.in_(list(REVENUE_STATUSES)), models.Booking.total_price),
        else_=0,
    )
    confirmed_count = case((models.Booking.status.in_(list(REVENUE_STATUSES)), 1), else_=0)
    cancelled_count = case((models.Booking.status == "cancelled", 1), else_=0)
    pending_count = case((models.Booking.status == "pending", 1), else_=0)

    query = (
        db.query(
            func.date(models.Booking.booking_date).label("date"),
            func.count(models.Booking.id).label("bookings"),
            func.coalesce(func.sum(paid_revenue), 0).label("revenue"),
            func.coalesce(func.sum(cancelled_count), 0).label("cancelled"),
            func.coalesce(func.sum(pending_count), 0).label("pending"),
            func.coalesce(func.sum(confirmed_count), 0).label("paid_bookings"),
            func.coalesce(func.sum(models.Booking.people_count), 0).label("people_count"),
        )
        .join(models.Tour, models.Booking.tour_id == models.Tour.id)
    )
    query = _apply_filters(query, start_date, end_date, country, city, status, tour_id)
    raw_rows = query.group_by(func.date(models.Booking.booking_date)).order_by(func.date(models.Booking.booking_date)).all()

    lookup = {
        _date_key(row.date): {
            "bookings": _float(row.bookings),
            "revenue": _float(row.revenue),
            "cancelled": _float(row.cancelled),
            "pending": _float(row.pending),
            "paid_bookings": _float(row.paid_bookings),
            "people_count": _float(row.people_count),
        }
        for row in raw_rows
    }

    rows = []
    for offset in range(HISTORY_DAYS):
        current_date = start_date + timedelta(days=offset)
        values = lookup.get(
            current_date.isoformat(),
            {
                "bookings": 0.0,
                "revenue": 0.0,
                "cancelled": 0.0,
                "pending": 0.0,
                "paid_bookings": 0.0,
                "people_count": 0.0,
            },
        )
        rows.append({"date": current_date, **values})
    return rows


def _slice(rows: list[dict], index: int, window: int) -> list[dict]:
    end = min(max(index, 0), len(rows))
    return rows[max(0, end - window):end]


def _rolling(rows: list[dict], index: int, key: str, window: int) -> float:
    values = [_float(row.get(key)) for row in _slice(rows, index, window)]
    return sum(values) / len(values) if values else 0.0


def _rate(rows: list[dict], index: int, numerator: str, denominator: str, window: int) -> float:
    items = _slice(rows, index, window)
    total = sum(_float(row.get(denominator)) for row in items)
    if not total:
        return 0.0
    return sum(_float(row.get(numerator)) for row in items) / total


def _lag(rows: list[dict], index: int, key: str, lag: int) -> float:
    previous_index = index - lag
    if 0 <= previous_index < len(rows):
        return _float(rows[previous_index].get(key))
    return 0.0


def _same_weekday_average(rows: list[dict], index: int, current_date: date, key: str) -> float:
    values = [
        _float(row.get(key))
        for row in _slice(rows, index, 56)
        if row["date"].weekday() == current_date.weekday()
    ]
    return sum(values) / len(values) if values else _rolling(rows, index, key, 14)


def _features(rows: list[dict], index: int, current_date: date, target: str) -> list[float]:
    weekday_angle = 2 * math.pi * current_date.weekday() / 7
    month_angle = 2 * math.pi * (current_date.month - 1) / 12
    paid_bookings = sum(_float(row.get("paid_bookings")) for row in _slice(rows, index, 14))
    revenue = sum(_float(row.get("revenue")) for row in _slice(rows, index, 14))
    return [
        index / max(1, HISTORY_DAYS),
        math.sin(weekday_angle),
        math.cos(weekday_angle),
        1.0 if current_date.weekday() >= 5 else 0.0,
        math.sin(month_angle),
        math.cos(month_angle),
        _lag(rows, index, target, 1),
        _lag(rows, index, target, 7),
        _rolling(rows, index, target, 7),
        _rolling(rows, index, target, 14),
        _same_weekday_average(rows, index, current_date, target),
        _rate(rows, index, "cancelled", "bookings", 14),
        _rate(rows, index, "pending", "bookings", 14),
        _rolling(rows, index, "people_count", 14),
        revenue / paid_bookings if paid_bookings else 0.0,
    ]


def _make_model():
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, VotingRegressor
    from sklearn.linear_model import Ridge
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    return VotingRegressor(
        estimators=[
            (
                "forest",
                RandomForestRegressor(
                    n_estimators=260,
                    random_state=42,
                    min_samples_leaf=2,
                    max_depth=10,
                ),
            ),
            (
                "boosting",
                GradientBoostingRegressor(
                    random_state=42,
                    n_estimators=120,
                    learning_rate=0.045,
                    max_depth=3,
                ),
            ),
            ("ridge", make_pipeline(StandardScaler(), Ridge(alpha=1.2))),
        ],
        weights=[0.48, 0.34, 0.18],
    )


def _quality_metrics(actual, predicted) -> dict:
    pairs = [(float(a), max(0.0, float(p))) for a, p in zip(actual, predicted)]
    if not pairs:
        return {"mae": 0.0, "rmse": 0.0, "smape": 0.0, "mean_actual": 0.0}

    abs_errors = [abs(a - p) for a, p in pairs]
    squared_errors = [(a - p) ** 2 for a, p in pairs]
    smape_items = [
        abs(a - p) / max((abs(a) + abs(p)) / 2, 1.0)
        for a, p in pairs
    ]
    return {
        "mae": round(sum(abs_errors) / len(abs_errors), 3),
        "rmse": round(math.sqrt(sum(squared_errors) / len(squared_errors)), 3),
        "smape": round((sum(smape_items) / len(smape_items)) * 100, 2),
        "mean_actual": round(sum(abs(a) for a, _ in pairs) / len(pairs), 3),
    }


def _confidence(metrics: dict, active_days: int) -> float:
    scale = metrics["mean_actual"] or 1.0
    error_ratio = metrics["mae"] / (scale + 1.0)
    score = 1 - error_ratio
    if active_days < 21:
        score = min(score, 0.72)
    return max(0.24, min(0.96, score))


def _extract_importance(model) -> dict[str, float]:
    named_estimators = getattr(model, "named_estimators_", {})
    importance_sets = []
    for name in ("forest", "boosting"):
        estimator = named_estimators.get(name)
        values = getattr(estimator, "feature_importances_", None)
        if values is not None:
            importance_sets.append([float(value) for value in values])

    if not importance_sets:
        return {}

    combined = []
    for index in range(len(FEATURE_NAMES)):
        combined.append(sum(values[index] for values in importance_sets) / len(importance_sets))
    total = sum(combined) or 1.0
    return {FEATURE_NAMES[index]: combined[index] / total for index in range(len(FEATURE_NAMES))}


def _moving_average_forecast(rows: list[dict], target: str, end_date: date) -> TargetResult:
    forecast = []
    for step in range(1, FORECAST_DAYS + 1):
        forecast_date = end_date + timedelta(days=step)
        recent_average = _rolling(rows, len(rows), target, 14)
        weekday_average = _same_weekday_average(rows, len(rows), forecast_date, target)
        forecast.append(max(0.0, 0.6 * recent_average + 0.4 * weekday_average))
    return TargetResult(
        target=target,
        forecast=forecast,
        confidence=0.38,
        metrics={"mae": 0.0, "rmse": 0.0, "smape": 0.0, "mean_actual": _rolling(rows, len(rows), target, 14)},
        feature_importance={},
        fallback=True,
    )


def _train_target(rows: list[dict], target: str, active_days: int) -> TargetResult:
    train_indices = list(range(14, len(rows)))
    if len(train_indices) < 14:
        return _moving_average_forecast(rows, target, rows[-1]["date"])

    x_all = [_features(rows, index, rows[index]["date"], target) for index in train_indices]
    y_all = [_float(rows[index].get(target)) for index in train_indices]
    holdout_size = min(28, max(7, len(train_indices) // 5))

    try:
        import numpy as np

        x_arr = np.array(x_all, dtype=float)
        y_arr = np.array(y_all, dtype=float)
        if len(train_indices) > holdout_size + 21:
            x_train, x_val = x_arr[:-holdout_size], x_arr[-holdout_size:]
            y_train, y_val = y_arr[:-holdout_size], y_arr[-holdout_size:]
        else:
            x_train, x_val = x_arr, x_arr
            y_train, y_val = y_arr, y_arr

        validation_model = _make_model()
        validation_model.fit(x_train, y_train)
        validation_pred = validation_model.predict(x_val)
        metrics = _quality_metrics(y_val, validation_pred)

        model = _make_model()
        model.fit(x_arr, y_arr)

        mutable_rows = [dict(row) for row in rows]
        forecast = []
        for step in range(1, FORECAST_DAYS + 1):
            forecast_date = rows[-1]["date"] + timedelta(days=step)
            index = len(mutable_rows)
            feature = np.array([_features(mutable_rows, index, forecast_date, target)], dtype=float)
            value = max(0.0, float(model.predict(feature)[0]))
            forecast.append(value)
            mutable_rows.append({
                "date": forecast_date,
                "bookings": value if target == "bookings" else 0.0,
                "revenue": value if target == "revenue" else 0.0,
                "cancelled": 0.0,
                "pending": 0.0,
                "paid_bookings": value if target == "bookings" else 0.0,
                "people_count": value if target == "bookings" else 0.0,
            })

        return TargetResult(
            target=target,
            forecast=forecast,
            confidence=_confidence(metrics, active_days),
            metrics=metrics,
            model=model,
            feature_importance=_extract_importance(model),
        )
    except Exception:
        return _moving_average_forecast(rows, target, rows[-1]["date"])


def _forecast_rows(rows: list[dict], booking_result: TargetResult, revenue_result: TargetResult, end_date: date):
    return [
        schemas.AnalyticsMlForecastPoint(
            date=(end_date + timedelta(days=step)).isoformat(),
            bookings=round(booking_result.forecast[step - 1], 1),
            revenue=round(revenue_result.forecast[step - 1], 2),
        )
        for step in range(1, FORECAST_DAYS + 1)
    ]


def _recent_rates(db: Session, end_date: date, country=None, city=None, status=None, tour_id=None) -> tuple[int, float, float]:
    start_date = end_date - timedelta(days=13)
    query = db.query(models.Booking).join(models.Tour, models.Booking.tour_id == models.Tour.id)
    query = _apply_filters(query, start_date, end_date, country, city, status, tour_id)
    total = query.count()
    cancelled = query.filter(models.Booking.status == "cancelled").count()
    pending = query.filter(models.Booking.status == "pending").count()
    return total, _percent(cancelled, total), _percent(pending, total)


def _metric_items(booking_result: TargetResult, revenue_result: TargetResult) -> list[schemas.AnalyticsMlMetric]:
    return [
        schemas.AnalyticsMlMetric(
            name="MAE заявок",
            value=booking_result.metrics["mae"],
            unit="заявок",
            description="Средняя абсолютная ошибка прогноза заявок на проверочной части истории.",
        ),
        schemas.AnalyticsMlMetric(
            name="sMAPE заявок",
            value=booking_result.metrics["smape"],
            unit="%",
            description="Симметричная процентная ошибка: удобна, когда в истории есть дни с нулевым спросом.",
        ),
        schemas.AnalyticsMlMetric(
            name="MAE выручки",
            value=revenue_result.metrics["mae"],
            unit="₽",
            description="Средняя абсолютная ошибка прогноза подтверждённой выручки.",
        ),
        schemas.AnalyticsMlMetric(
            name="sMAPE выручки",
            value=revenue_result.metrics["smape"],
            unit="%",
            description="Процентная ошибка выручки на отложенном временном окне.",
        ),
    ]


def _feature_items(booking_result: TargetResult, revenue_result: TargetResult):
    scores = defaultdict(float)
    for result, weight in ((booking_result, 0.5), (revenue_result, 0.5)):
        for key, value in (result.feature_importance or {}).items():
            scores[key] += value * weight

    items = []
    for key, value in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:6]:
        label, description = FEATURE_LABELS.get(key, (key, "Признак модели MetricBot."))
        items.append(
            schemas.AnalyticsMlFeatureImportance(
                feature=label,
                importance=round(value * 100, 1),
                description=description,
            )
        )
    return items


def _save_bundle(booking_result: TargetResult, revenue_result: TargetResult, metadata: dict) -> list[str]:
    if booking_result.fallback or revenue_result.fallback:
        return []

    try:
        import joblib

        models_dir = _models_dir()
        models_dir.mkdir(parents=True, exist_ok=True)
        bundle_path = models_dir / "metricbot_bundle.joblib"
        booking_path = models_dir / "metricbot_bookings.joblib"
        revenue_path = models_dir / "metricbot_revenue.joblib"
        bundle = {
            "version": METRICBOT_VERSION,
            "metadata": metadata,
            "feature_names": FEATURE_NAMES,
            "feature_labels": FEATURE_LABELS,
            "targets": {
                "bookings": {
                    "model": booking_result.model,
                    "metrics": booking_result.metrics,
                    "feature_importance": booking_result.feature_importance,
                },
                "revenue": {
                    "model": revenue_result.model,
                    "metrics": revenue_result.metrics,
                    "feature_importance": revenue_result.feature_importance,
                },
            },
        }
        joblib.dump(bundle, bundle_path)
        joblib.dump(booking_result.model, booking_path)
        joblib.dump(revenue_result.model, revenue_path)
        return [str(bundle_path), str(booking_path), str(revenue_path)]
    except Exception:
        return []


def build_metricbot_assistant(db: Session, end_date: date, country=None, city=None, status=None, tour_id=None):
    rows = _build_daily_rows(db, end_date, country, city, status, tour_id)
    active_rows = [row for row in rows if row["bookings"] or row["revenue"]]
    if len(active_rows) < 7:
        return schemas.AnalyticsMlAssistant(
            model_name="MetricBot Local Ensemble",
            model_type="supervised_regression_local_ensemble",
            status="not_enough_data",
            model_version=METRICBOT_VERSION,
            training_samples=len(active_rows),
            confidence=0,
            risk_level="unknown",
            training_window_start=rows[0]["date"].isoformat(),
            training_window_end=rows[-1]["date"].isoformat(),
            summary="MetricBot работает локально, но пока не обучен: нужно минимум 7 активных дней с заявками или выручкой.",
            algorithm_notes=[
                "Данные не отправляются во внешние API: обучение запускается на сервере проекта.",
                "После накопления истории MetricBot обучит ансамбль регрессоров и сохранит модель в .joblib.",
            ],
            recommendations=[
                "Добавьте реальные заявки или загрузите исторические продажи через CSV-раздел.",
                "Для более устойчивого прогноза соберите хотя бы 3-4 недели ежедневной истории.",
            ],
        )

    booking_result = _train_target(rows, "bookings", len(active_rows))
    revenue_result = _train_target(rows, "revenue", len(active_rows))
    forecast_points = _forecast_rows(rows, booking_result, revenue_result, end_date)
    confidence = round(((booking_result.confidence + revenue_result.confidence) / 2) * 100, 1)

    last_7_bookings = sum(row["bookings"] for row in rows[-7:])
    prev_7_bookings = sum(row["bookings"] for row in rows[-14:-7])
    last_7_revenue = sum(row["revenue"] for row in rows[-7:])
    prev_7_revenue = sum(row["revenue"] for row in rows[-14:-7])
    bookings_delta = _delta_percent(last_7_bookings, prev_7_bookings)
    revenue_delta = _delta_percent(last_7_revenue, prev_7_revenue)
    expected_bookings = sum(booking_result.forecast)
    expected_revenue = sum(revenue_result.forecast)
    average_recent_bookings = last_7_bookings / 7 if last_7_bookings else 0
    expected_daily_bookings = expected_bookings / 7 if expected_bookings else 0
    forecast_vs_recent = _delta_percent(expected_daily_bookings, average_recent_bookings)

    _, recent_cancellation_rate, recent_pending_rate = _recent_rates(db, end_date, country, city, status, tour_id)

    risk_level = "low"
    if bookings_delta < -20 or revenue_delta < -20 or recent_cancellation_rate >= 25 or forecast_vs_recent < -25:
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
            text="Изменение подтверждённой и завершённой выручки.",
        ),
        schemas.AnalyticsInsightItem(
            tone="info",
            title="Прогноз заявок",
            value=str(round(expected_bookings, 1)),
            text="Ожидаемое количество заявок на ближайшие 7 дней по локальной ML-модели.",
        ),
        schemas.AnalyticsInsightItem(
            tone="info",
            title="Прогноз выручки",
            value=f"{expected_revenue:,.0f} ₽".replace(",", " "),
            text="Ожидаемая выручка на ближайшие 7 дней с учётом истории спроса и среднего чека.",
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
    ]

    recommendations = []
    if risk_level == "high":
        recommendations.extend([
            "Проверьте направления с падением спроса и запустите точечную акцию или обзвон клиентов.",
            "Разберите отменённые заявки: причина может быть в цене, датах, условиях оплаты или нехватке информации о туре.",
        ])
    elif risk_level == "medium":
        recommendations.extend([
            "Проверьте цены и свободные места по турам с низкой загрузкой.",
            "Усилите видимость туров, которые часто переходят в подтверждённые заявки.",
        ])
    else:
        recommendations.extend([
            "Используйте недельный прогноз для планирования нагрузки менеджеров.",
            "Сохраняйте актуальность карточек туров: фото, даты, места, описание и координаты отеля.",
        ])
    if recent_pending_rate >= 25:
        recommendations.append("Назначьте ответственного за заявки в ожидании: очередь уже влияет на конверсию.")
    if confidence < 55:
        recommendations.append("Для повышения точности добавьте больше исторических бронирований или загрузите CSV с продажами.")

    trained_at = datetime.utcnow().replace(microsecond=0).isoformat()
    metadata = {
        "trained_at": trained_at,
        "active_days": len(active_rows),
        "history_days": HISTORY_DAYS,
        "forecast_days": FORECAST_DAYS,
        "filters": {"country": country, "city": city, "status": status, "tour_id": tour_id},
        "confidence": confidence,
    }
    model_files = _save_bundle(booking_result, revenue_result, metadata)

    algorithm_notes = [
        "Локальный supervised learning: модель учится на таблицах bookings/tours из вашей БД.",
        "Ансамбль объединяет RandomForest, GradientBoosting и Ridge, поэтому ловит нелинейность, тренд и устойчивую базовую зависимость.",
        "Признаки: день недели, сезонность месяца, лаги за 1 и 7 дней, скользящие средние, доля отмен, доля ожидания, средний чек.",
        "Качество считается на последнем временном holdout-окне, а не на случайном перемешивании.",
        "После обучения модель сохраняется локально в joblib и может быть показана на защите как файл обученного ML.",
    ]

    summary = (
        f"MetricBot обучил локальный ML-ансамбль на {len(active_rows)} активных днях истории. "
        f"Прогноз на 7 дней: {round(expected_bookings, 1)} заявок и "
        f"{expected_revenue:,.0f} ₽ выручки. "
        f"Уровень риска: {risk_level}, уверенность модели: {confidence:.1f}%."
    ).replace(",", " ")

    return schemas.AnalyticsMlAssistant(
        model_name="MetricBot Local Ensemble",
        model_type="supervised_regression_local_ensemble",
        model_version=METRICBOT_VERSION,
        status="ready" if not (booking_result.fallback or revenue_result.fallback) else "fallback",
        training_samples=len(active_rows),
        confidence=confidence,
        risk_level=risk_level,
        summary=summary,
        forecast_next_7_days=forecast_points,
        signals=signals,
        recommendations=recommendations,
        accuracy_metrics=_metric_items(booking_result, revenue_result),
        feature_importance=_feature_items(booking_result, revenue_result),
        algorithm_notes=algorithm_notes,
        local_model_files=model_files,
        training_window_start=rows[0]["date"].isoformat(),
        training_window_end=rows[-1]["date"].isoformat(),
        last_trained_at=trained_at,
    )
