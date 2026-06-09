import json
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db


router = APIRouter(prefix="/tour-plans", tags=["tour plans"])

CLIENT_STATUSES = {"draft", "submitted"}
STAFF_STATUSES = {"draft", "submitted", "in_review", "approved", "rejected"}
PACKAGE_TYPES = {"standard", "comfort", "all_inclusive", "custom"}
PACE_TYPES = {"relaxed", "balanced", "active"}
MEAL_RATES = {
    "none": 0,
    "breakfast": 1200,
    "half_board": 2400,
    "full_board": 3600,
    "all_inclusive": 4600,
}
HOTEL_RATES = {
    "base": 0,
    "comfort": 1800,
    "premium": 3800,
}
TRANSFER_RATES = {
    "none": 0,
    "group": 1800,
    "individual": 6500,
}


def _is_staff(user: models.User) -> bool:
    return user.role in {"admin", "manager"}


def _to_float(value) -> float:
    return float(value or 0)


def _json_dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _json_load(value, fallback):
    try:
        return json.loads(value or "")
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback


def _validate_payload(payload: schemas.TourPlanCreate, *, is_staff: bool = False):
    allowed_statuses = STAFF_STATUSES if is_staff else CLIENT_STATUSES
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Недопустимый статус индивидуального плана")
    if payload.package_type not in PACKAGE_TYPES:
        raise HTTPException(status_code=400, detail="Недопустимый тип пакета")
    if payload.pace not in PACE_TYPES:
        raise HTTPException(status_code=400, detail="Недопустимый темп программы")
    if payload.services.meal_plan not in MEAL_RATES:
        raise HTTPException(status_code=400, detail="Недопустимый тип питания")
    if payload.services.hotel_level not in HOTEL_RATES:
        raise HTTPException(status_code=400, detail="Недопустимый уровень размещения")
    if payload.services.transfer not in TRANSFER_RATES:
        raise HTTPException(status_code=400, detail="Недопустимый тип трансфера")
    if payload.status == "submitted" and not payload.program:
        raise HTTPException(
            status_code=400,
            detail="Перед отправкой заявки сформируйте программу хотя бы на один день",
        )


def _calculate_estimate(db: Session, payload: schemas.TourPlanCreate) -> tuple[float, float, float]:
    tour_ids = [item.tour_id for item in payload.route if item.tour_id is not None]
    tours = (
        db.query(models.Tour)
        .filter(models.Tour.id.in_(set(tour_ids)))
        .all()
        if tour_ids
        else []
    )
    tour_by_id = {tour.id: tour for tour in tours}
    missing_ids = sorted(set(tour_ids) - set(tour_by_id))
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"В маршруте найдены недоступные туры: {', '.join(map(str, missing_ids))}",
        )

    base_per_person = 0.0
    for item in payload.route:
        if not item.tour_id:
            continue
        tour = tour_by_id[item.tour_id]
        original_days = max(int(tour.duration or 1), 1)
        selected_days = max(int(item.tour_duration or original_days), 1)
        base_per_person += _to_float(tour.price) * selected_days / original_days
    base_price = base_per_person * payload.people_count

    route_days = sum(
        max(int(item.tour_duration or tour_by_id[item.tour_id].duration or 0), 0)
        for item in payload.route
        if item.tour_id
    )
    program_days = max((item.day for item in payload.program), default=0)
    days = max(program_days, route_days, 1)
    services = payload.services

    per_person = (
        (MEAL_RATES[services.meal_plan] + HOTEL_RATES[services.hotel_level]) * days
        + TRANSFER_RATES[services.transfer]
    )
    services_price = per_person * payload.people_count
    estimated_total = base_price + services_price

    return tuple(round(value, 2) for value in (base_price, services_price, estimated_total))


def _serialize(plan: models.CustomTourPlan) -> schemas.TourPlanResponse:
    return schemas.TourPlanResponse(
        id=plan.id,
        user_id=plan.user_id,
        title=plan.title,
        country=plan.country,
        people_count=plan.people_count,
        budget=_to_float(plan.budget) if plan.budget is not None else None,
        pace=plan.pace,
        interest=plan.interest,
        package_type=plan.package_type,
        services=_json_load(plan.services_json, {}),
        route=_json_load(plan.route_json, []),
        activities=_json_load(plan.activities_json, []),
        program=_json_load(plan.program_json, []),
        special_requests=plan.special_requests,
        status=plan.status,
        base_price=_to_float(plan.base_price),
        services_price=_to_float(plan.services_price),
        estimated_total=_to_float(plan.estimated_total),
        user_email=getattr(getattr(plan, "user", None), "email", None),
        user_phone=getattr(getattr(plan, "user", None), "phone", None),
        user_first_name=getattr(getattr(plan, "user", None), "first_name", None),
        user_last_name=getattr(getattr(plan, "user", None), "last_name", None),
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _apply_payload(
    db: Session,
    plan: models.CustomTourPlan,
    payload: schemas.TourPlanCreate,
    *,
    is_staff: bool = False,
):
    _validate_payload(payload, is_staff=is_staff)
    base_price, services_price, estimated_total = _calculate_estimate(db, payload)

    plan.title = payload.title.strip()
    plan.country = payload.country.strip()
    plan.people_count = payload.people_count
    plan.budget = Decimal(str(payload.budget)) if payload.budget is not None else None
    plan.pace = payload.pace
    plan.interest = payload.interest
    plan.package_type = payload.package_type
    plan.services_json = _json_dump(payload.services.model_dump(mode="json"))
    plan.route_json = _json_dump([item.model_dump(mode="json") for item in payload.route])
    plan.activities_json = _json_dump(
        [item.model_dump(mode="json") for item in payload.activities]
    )
    plan.program_json = _json_dump([item.model_dump(mode="json") for item in payload.program])
    plan.special_requests = (payload.special_requests or "").strip() or None
    plan.base_price = Decimal(str(base_price))
    plan.services_price = Decimal(str(services_price))
    plan.estimated_total = Decimal(str(estimated_total))
    plan.status = payload.status


def _get_plan_or_404(db: Session, plan_id: int) -> models.CustomTourPlan:
    plan = db.query(models.CustomTourPlan).filter(models.CustomTourPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Индивидуальный план не найден")
    return plan


def _ensure_access(plan: models.CustomTourPlan, user: models.User):
    if not _is_staff(user) and plan.user_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")


def _create_submission_notifications(db: Session, plan: models.CustomTourPlan):
    db.add(
        models.Notification(
            user_id=plan.user_id,
            title="Индивидуальный тур отправлен",
            message=f"План «{plan.title}» передан менеджеру на расчёт и согласование.",
            type="info",
            is_read=False,
        )
    )
    staff_users = db.query(models.User).filter(models.User.role.in_(["admin", "manager"])).all()
    for staff_user in staff_users:
        db.add(
            models.Notification(
                user_id=staff_user.id,
                title="Новая заявка на индивидуальный тур",
                message=f"Поступил план «{plan.title}» на {plan.people_count} чел.",
                type="info",
                is_read=False,
            )
        )


@router.get("/", response_model=List[schemas.TourPlanResponse])
def get_tour_plans(
    plan_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    query = db.query(models.CustomTourPlan)
    if not _is_staff(current_user):
        query = query.filter(models.CustomTourPlan.user_id == current_user.id)
    if plan_status:
        query = query.filter(models.CustomTourPlan.status == plan_status)
    plans = query.order_by(models.CustomTourPlan.updated_at.desc(), models.CustomTourPlan.id.desc()).all()
    return [_serialize(plan) for plan in plans]


@router.post("/", response_model=schemas.TourPlanResponse, status_code=status.HTTP_201_CREATED)
def create_tour_plan(
    payload: schemas.TourPlanCreate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    plan = models.CustomTourPlan(user_id=current_user.id)
    _apply_payload(db, plan, payload, is_staff=_is_staff(current_user))
    db.add(plan)
    db.flush()
    if plan.status == "submitted":
        _create_submission_notifications(db, plan)
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.get("/{plan_id}", response_model=schemas.TourPlanResponse)
def get_tour_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    plan = _get_plan_or_404(db, plan_id)
    _ensure_access(plan, current_user)
    return _serialize(plan)


@router.put("/{plan_id}", response_model=schemas.TourPlanResponse)
def update_tour_plan(
    plan_id: int,
    payload: schemas.TourPlanCreate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    plan = _get_plan_or_404(db, plan_id)
    _ensure_access(plan, current_user)
    if not _is_staff(current_user) and plan.status in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Завершённый план нельзя редактировать")

    old_status = plan.status
    _apply_payload(db, plan, payload, is_staff=_is_staff(current_user))
    if old_status != "submitted" and plan.status == "submitted":
        _create_submission_notifications(db, plan)
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.patch("/{plan_id}/status", response_model=schemas.TourPlanResponse)
def update_tour_plan_status(
    plan_id: int,
    payload: schemas.TourPlanStatusUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    if not _is_staff(current_user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    if payload.status not in STAFF_STATUSES:
        raise HTTPException(status_code=400, detail="Недопустимый статус индивидуального плана")

    plan = _get_plan_or_404(db, plan_id)
    plan.status = payload.status
    db.add(
        models.Notification(
            user_id=plan.user_id,
            title="Статус индивидуального тура обновлён",
            message=f"План «{plan.title}»: новый статус — {payload.status}.",
            type="info",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(plan)
    return _serialize(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tour_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = auth.get_current_user_from_token(token, db)
    plan = _get_plan_or_404(db, plan_id)
    _ensure_access(plan, current_user)
    if not _is_staff(current_user) and plan.status != "draft":
        raise HTTPException(status_code=400, detail="Можно удалить только черновик")
    db.delete(plan)
    db.commit()
    return None
