from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, field_validator


# =========================
# USERS
# =========================

class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_data: Optional[str] = None
    avatar_type: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_data: Optional[str] = None
    avatar_type: Optional[str] = None
    password: Optional[str] = None


class UserAvatarUpdate(BaseModel):
    avatar_data: Optional[str] = None
    avatar_type: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: int
    role: str
    is_verified: bool
    created_at: datetime
    last_seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserResponse(User):
    pass


# =========================
# AUTH / TOKEN
# =========================

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# =========================
# EMAIL VERIFICATION
# =========================

class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


# =========================
# PASSWORD RESET
# =========================

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str


# =========================
# TOURS
# =========================

class TourBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    duration: int
    start_date: date
    end_date: date
    country: str
    city: str
    max_people: int
    program: Optional[str] = None
    accommodation: Optional[str] = None
    meals: Optional[str] = None
    meals_features: Optional[str] = None
    activities: Optional[str] = None
    activities_features: Optional[str] = None
    resort_info: Optional[str] = None
    resort_features: Optional[str] = None
    program_details: Optional[str] = None
    hotel_name: Optional[str] = None
    hotel_address: Optional[str] = None
    hotel_description: Optional[str] = None
    hotel_features: Optional[str] = None
    hotel_map_lat: Optional[float] = None
    hotel_map_lng: Optional[float] = None
    hotel_map_zoom: Optional[int] = 15
    map_lat: Optional[float] = None
    map_lng: Optional[float] = None
    map_zoom: Optional[int] = 12


class TourCreate(TourBase):
    image_base64: Optional[str] = None
    image_type: Optional[str] = None
    image_url: Optional[str] = None
    country_id: Optional[int] = None
    resort_id: Optional[int] = None


class TourGalleryImageInput(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    image_type: Optional[str] = None
    alt_text: Optional[str] = None
    sort_order: Optional[int] = 0


class TourImageResponse(BaseModel):
    id: int
    tour_id: int
    image_url: Optional[str] = None
    image_data: Optional[str] = None
    image_type: Optional[str] = None
    alt_text: Optional[str] = None
    sort_order: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TourGalleryUpdate(BaseModel):
    images: List[TourGalleryImageInput] = Field(default_factory=list)


class TourUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    country: Optional[str] = None
    city: Optional[str] = None
    max_people: Optional[int] = None
    program: Optional[str] = None
    accommodation: Optional[str] = None
    meals: Optional[str] = None
    meals_features: Optional[str] = None
    activities: Optional[str] = None
    activities_features: Optional[str] = None
    resort_info: Optional[str] = None
    resort_features: Optional[str] = None
    program_details: Optional[str] = None
    hotel_name: Optional[str] = None
    hotel_address: Optional[str] = None
    hotel_description: Optional[str] = None
    hotel_features: Optional[str] = None
    hotel_map_lat: Optional[float] = None
    hotel_map_lng: Optional[float] = None
    hotel_map_zoom: Optional[int] = None
    map_lat: Optional[float] = None
    map_lng: Optional[float] = None
    map_zoom: Optional[int] = None
    image_base64: Optional[str] = None
    image_type: Optional[str] = None
    image_url: Optional[str] = None
    remove_image: Optional[bool] = None
    country_id: Optional[int] = None
    resort_id: Optional[int] = None


class Tour(TourBase):
    id: int
    created_at: datetime
    image_data: Optional[str] = None
    image_type: Optional[str] = None
    image_url: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    reserved_seats: Optional[int] = 0
    available_seats: Optional[int] = 0
    is_archived: Optional[bool] = False
    hotel_name: Optional[str] = None
    hotel_address: Optional[str] = None
    hotel_description: Optional[str] = None
    hotel_features: Optional[str] = None
    hotel_map_lat: Optional[float] = None
    hotel_map_lng: Optional[float] = None
    hotel_map_zoom: Optional[int] = 15
    map_lat: Optional[float] = None
    map_lng: Optional[float] = None
    map_zoom: Optional[int] = 12
    country_id: Optional[int] = None
    resort_id: Optional[int] = None
    gallery_images: List[TourImageResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class TourResponse(Tour):
    pass


# =========================
# BOOKINGS
# =========================

class BookingBase(BaseModel):
    tour_id: int
    people_count: int


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    people_count: Optional[int] = None
    status: Optional[str] = None
    payment_status_id: Optional[int] = None
    payment_method_id: Optional[int] = None
    note: Optional[str] = None


class Booking(BaseModel):
    id: int
    user_id: int
    tour_id: int
    people_count: int
    total_price: Optional[float] = None
    discount_amount: Optional[float] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    promo_code_id: Optional[int] = None
    status_id: Optional[int] = None
    payment_status_id: Optional[int] = None
    payment_method_id: Optional[int] = None
    booking_date: datetime

    class Config:
        from_attributes = True


class BookingResponse(Booking):
    created_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None


class BookingStatusHistoryResponse(BaseModel):
    id: int
    booking_id: int
    old_status: Optional[str] = None
    old_status_name: Optional[str] = None
    new_status: Optional[str] = None
    new_status_name: Optional[str] = None
    changed_by_user_id: Optional[int] = None
    changed_by_user_email: Optional[str] = None
    note: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True


# =========================
# CUSTOM TOUR PLANS
# =========================

class TourPlanRouteItem(BaseModel):
    order: int = Field(ge=1, le=30)
    city: str = Field(min_length=1, max_length=100)
    tour_id: Optional[int] = None
    tour_title: Optional[str] = Field(default=None, max_length=255)
    tour_duration: Optional[int] = Field(default=None, ge=0, le=60)
    tour_price: Optional[float] = Field(default=None, ge=0)
    tour_start_date: Optional[date] = None
    tour_end_date: Optional[date] = None
    customization: Optional[str] = Field(default=None, max_length=2000)


class TourPlanActivityItem(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    activity_type: str = Field(default="Активность", max_length=80)
    description: Optional[str] = Field(default=None, max_length=3000)
    source: Optional[str] = Field(default=None, max_length=30)
    source_id: Optional[str] = Field(default=None, max_length=100)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def accept_date_only_values(cls, value):
        if isinstance(value, date) and not isinstance(value, datetime):
            return datetime.combine(value, datetime.min.time())
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            if len(value) == 10:
                try:
                    return datetime.combine(date.fromisoformat(value), datetime.min.time())
                except ValueError:
                    pass
        return value


class TourPlanDay(BaseModel):
    day: int = Field(ge=1, le=60)
    city: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=3000)


class TourPlanServices(BaseModel):
    meal_plan: str = "breakfast"
    hotel_level: str = "comfort"
    transfer: str = "group"
    insurance: bool = True
    guide: bool = False
    excursions: bool = False
    priority_support: bool = False


class TourPlanCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    country: str = Field(min_length=1, max_length=100)
    people_count: int = Field(ge=1, le=20)
    budget: Optional[float] = Field(default=None, ge=0)
    pace: str = Field(default="balanced", max_length=30)
    interest: str = Field(default="culture", max_length=50)
    package_type: str = Field(default="comfort", max_length=30)
    services: TourPlanServices = Field(default_factory=TourPlanServices)
    route: List[TourPlanRouteItem] = Field(min_length=1, max_length=20)
    activities: List[TourPlanActivityItem] = Field(default_factory=list, max_length=100)
    program: List[TourPlanDay] = Field(default_factory=list, max_length=60)
    special_requests: Optional[str] = Field(default=None, max_length=5000)
    status: str = "draft"


class TourPlanStatusUpdate(BaseModel):
    status: str


class TourPlanResponse(TourPlanCreate):
    id: int
    user_id: int
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None
    base_price: float = 0
    services_price: float = 0
    estimated_total: float = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


# =========================
# REVIEWS
# =========================

class ReviewBase(BaseModel):
    tour_id: int
    rating: int
    comment: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None


class Review(ReviewBase):
    id: int
    user_id: int
    created_at: datetime
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None

    class Config:
        from_attributes = True


class ReviewResponse(Review):
    pass


# =========================
# FAVORITES
# =========================

class FavoriteCreate(BaseModel):
    tour_id: int


class Favorite(BaseModel):
    id: int
    user_id: int
    tour_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FavoriteResponse(Favorite):
    pass


# =========================
# NOTIFICATIONS
# =========================

class Notification(BaseModel):
    id: int
    title: str
    message: str
    type: Optional[str] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationResponse(Notification):
    pass


class NotificationSettings(BaseModel):
    email_booking_confirmation: bool = True
    email_booking_updates: bool = True
    email_newsletter: bool = False
    email_promotions: bool = False


class NotificationSettingsResponse(NotificationSettings):
    user_id: int

    class Config:
        from_attributes = True


# =========================
# PAYMENTS
# =========================

class PaymentCreate(BaseModel):
    booking_id: int
    payment_method_id: int
    amount: float


class PaymentResponse(BaseModel):
    id: int
    booking_id: int
    payment_method_id: Optional[int] = None
    payment_status_id: Optional[int] = None
    amount: float
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# =========================
# EXPORT / STATS / ANALYTICS
# =========================

class UserStatsResponse(BaseModel):
    users: dict
    tours: dict
    bookings: dict
    reviews: dict


class ActivityPoint(BaseModel):
    date: str
    count: int


class ActivityStatsResponse(BaseModel):
    registrations: List[ActivityPoint]
    bookings: List[ActivityPoint]


class ReviewModerate(BaseModel):
    is_approved: bool
    moderation_comment: Optional[str] = None


class AnalyticsOverview(BaseModel):
    total_users: int
    online_users: int = 0
    total_tours: int
    active_tours: int = 0
    archived_tours: int = 0
    total_bookings: int
    confirmed_bookings: int
    pending_bookings: int
    cancelled_bookings: int
    completed_bookings: int = 0
    total_revenue: float
    average_check: float = 0
    average_rating: float
    reviews_count: int = 0
    reserved_seats: int = 0
    available_seats: int = 0
    occupancy_rate: float = 0


class AnalyticsChartPoint(BaseModel):
    date: str
    value: int


class AnalyticsMoneyPoint(BaseModel):
    date: str
    value: float


class AnalyticsStatusItem(BaseModel):
    status: str
    count: int


class AnalyticsDimensionItem(BaseModel):
    name: str
    value: int
    revenue: float = 0


class AnalyticsTopTourItem(BaseModel):
    tour_id: int
    title: str
    bookings_count: int
    revenue: float


class AnalyticsTourCapacityItem(BaseModel):
    tour_id: int
    title: str
    max_people: int
    reserved_seats: int
    available_seats: int
    occupancy_rate: float


class AnalyticsBreakdownItem(BaseModel):
    name: str
    value: int = 0
    revenue: float = 0
    rate: float = 0


class AnalyticsFunnelStep(BaseModel):
    name: str
    value: int
    rate: float = 0


class AnalyticsInsightItem(BaseModel):
    tone: str = "info"
    title: str
    value: str
    text: str


class AnalyticsPeriodComparison(BaseModel):
    previous_start_date: str
    previous_end_date: str
    bookings_delta_percent: float = 0
    revenue_delta_percent: float = 0
    cancelled_delta_percent: float = 0
    average_check_delta_percent: float = 0


class AnalyticsDataQualityMetric(BaseModel):
    name: str
    value: int
    severity: str = "info"
    description: str


class AnalyticsMlForecastPoint(BaseModel):
    date: str
    bookings: float = 0
    revenue: float = 0


class AnalyticsMlMetric(BaseModel):
    name: str
    value: float = 0
    unit: str = ""
    description: str = ""


class AnalyticsMlFeatureImportance(BaseModel):
    feature: str
    importance: float = 0
    description: str = ""


class AnalyticsMlAssistant(BaseModel):
    model_config = {"protected_namespaces": ()}

    model_name: str = "MetricBot Ridge"
    model_type: str = "supervised_regression"
    model_version: str = "metricbot-local-v1"
    status: str = "ready"
    training_samples: int = 0
    confidence: float = 0
    risk_level: str = "low"
    summary: str = ""
    forecast_next_7_days: List[AnalyticsMlForecastPoint] = Field(default_factory=list)
    signals: List[AnalyticsInsightItem] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    accuracy_metrics: List[AnalyticsMlMetric] = Field(default_factory=list)
    feature_importance: List[AnalyticsMlFeatureImportance] = Field(default_factory=list)
    algorithm_notes: List[str] = Field(default_factory=list)
    local_model_files: List[str] = Field(default_factory=list)
    training_window_start: Optional[str] = None
    training_window_end: Optional[str] = None
    last_trained_at: Optional[str] = None


class CsvDatasetMeta(BaseModel):
    id: str
    filename: str
    original_filename: str
    dataset_type: str = "dataset"
    uploaded_by_user_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    size_bytes: int = 0
    rows_count: int = 0
    columns_count: int = 0
    columns: List[str] = Field(default_factory=list)
    created_at: datetime
    issues: List[str] = Field(default_factory=list)


class CsvPreviewResponse(BaseModel):
    meta: CsvDatasetMeta
    sample_rows: List[dict] = Field(default_factory=list)


class CsvUploadResponse(CsvPreviewResponse):
    pass


class TourCsvImportResult(BaseModel):
    created: int = 0
    skipped: int = 0
    errors: List[str] = Field(default_factory=list)
    created_ids: List[int] = Field(default_factory=list)


class AnalyticsDashboardResponse(BaseModel):
    overview: AnalyticsOverview
    users_by_day: List[AnalyticsChartPoint]
    bookings_by_day: List[AnalyticsChartPoint]
    revenue_by_day: List[AnalyticsMoneyPoint] = []
    booking_statuses: List[AnalyticsStatusItem]
    bookings_by_country: List[AnalyticsDimensionItem] = []
    bookings_by_city: List[AnalyticsDimensionItem] = []
    top_tours: List[AnalyticsTopTourItem]
    capacity_by_tour: List[AnalyticsTourCapacityItem] = []
    payment_statuses: List[AnalyticsBreakdownItem] = []
    payment_methods: List[AnalyticsBreakdownItem] = []
    weekday_demand: List[AnalyticsBreakdownItem] = []
    price_segments: List[AnalyticsBreakdownItem] = []
    duration_segments: List[AnalyticsBreakdownItem] = []
    conversion_funnel: List[AnalyticsFunnelStep] = []
    analyst_insights: List[AnalyticsInsightItem] = []
    period_comparison: Optional[AnalyticsPeriodComparison] = None
    data_quality: List[AnalyticsDataQualityMetric] = []
    ml_assistant: Optional[AnalyticsMlAssistant] = None


# =========================
# EVENTS
# =========================

class EventBase(BaseModel):
    title: str
    summary: Optional[str] = None
    content: str
    event_type: str
    format_type: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    is_published: bool = True


class EventCreate(EventBase):
    image_base64: Optional[str] = None
    image_type: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    event_type: Optional[str] = None
    format_type: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    image_type: Optional[str] = None
    remove_image: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None


class EventResponse(EventBase):
    id: int
    image_data: Optional[str] = None
    image_type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
