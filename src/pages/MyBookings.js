import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import {
  BookingListSkeleton,
  PageHeroSkeleton,
  StatSkeleton,
} from '../components/Skeletons';

const statusMap = {
  pending: { label: 'Ожидание', className: 'ui-chip ui-chip--warning' },
  confirmed: { label: 'Подтверждено', className: 'ui-chip ui-chip--success' },
  completed: { label: 'Завершено', className: 'ui-chip ui-chip--accent' },
  cancelled: { label: 'Отменено', className: 'ui-chip ui-chip--danger' },
};

const paymentMap = {
  pending: { label: 'Ожидает оплаты', className: 'ui-chip ui-chip--warning' },
  paid: { label: 'Оплачено', className: 'ui-chip ui-chip--success' },
  failed: { label: 'Ошибка оплаты', className: 'ui-chip ui-chip--danger' },
};

const planStatusMap = {
  draft: { label: 'Черновик', className: 'ui-chip' },
  submitted: { label: 'Отправлен', className: 'ui-chip ui-chip--warning' },
  in_review: { label: 'На рассмотрении', className: 'ui-chip ui-chip--accent' },
  approved: { label: 'Согласован', className: 'ui-chip ui-chip--success' },
  rejected: { label: 'Нужны изменения', className: 'ui-chip ui-chip--danger' },
};

const packageLabels = {
  standard: 'Базовый',
  comfort: 'Комфорт',
  all_inclusive: 'Всё включено',
  custom: 'Свой пакет',
};

const paceLabels = {
  relaxed: 'Спокойный',
  balanced: 'Сбалансированный',
  active: 'Активный',
};

const interestLabels = {
  culture: 'Культура',
  nature: 'Природа',
  family: 'Семейный отдых',
  gastro: 'Гастрономия',
};

const mealLabels = {
  none: 'Без питания',
  breakfast: 'Завтраки',
  half_board: 'Завтрак и ужин',
  full_board: 'Трёхразовое питание',
  all_inclusive: 'Всё включено',
};

const hotelLabels = {
  base: 'Базовое',
  comfort: 'Комфорт',
  premium: 'Премиум',
};

const transferLabels = {
  none: 'Не включён',
  group: 'Групповой',
  individual: 'Индивидуальный',
};

const optionalServices = [
  ['insurance', 'Туристическая страховка'],
  ['guide', 'Персональный гид'],
  ['excursions', 'Пакет экскурсий'],
  ['priority_support', 'Приоритетная поддержка'],
];

const MyBookings = () => {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [tours, setTours] = useState([]);
  const [tourPlans, setTourPlans] = useState([]);
  const [selectedTourPlan, setSelectedTourPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [bookingsResponse, toursResponse, plansResponse] = await Promise.all([
        tourismAPI.getBookings(),
        tourismAPI.getTours(),
        tourismAPI.getTourPlans(),
      ]);

      setBookings(bookingsResponse.data || []);
      setTours(toursResponse.data || []);
      setTourPlans(plansResponse.data || []);
    } catch (err) {
      console.error('Ошибка загрузки бронирований:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      setError('Не удалось загрузить бронирования');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const closeTourPlan = useCallback(() => {
    setSelectedTourPlan(null);
  }, []);

  useEffect(() => {
    if (!selectedTourPlan) {
      document.body.style.overflow = '';
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeTourPlan();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTourPlan, closeTourPlan]);

  const enrichedBookings = useMemo(() => {
    return [...bookings]
      .map((booking) => {
        const tour = tours.find((item) => item.id === booking.tour_id);

        return {
          ...booking,
          tour,
        };
      })
      .sort((a, b) => {
        const aDate = new Date(a.booking_date || a.created_at || 0).getTime();
        const bDate = new Date(b.booking_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });
  }, [bookings, tours]);

  const stats = useMemo(() => {
    const total = enrichedBookings.length;
    const confirmed = enrichedBookings.filter((item) => item.status === 'confirmed').length;
    const pending = enrichedBookings.filter((item) => item.status === 'pending').length;
    const completed = enrichedBookings.filter((item) => item.status === 'completed').length;

    return { total, confirmed, pending, completed };
  }, [enrichedBookings]);

  const sortedTourPlans = useMemo(() => {
    return [...tourPlans].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  }, [tourPlans]);

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU');
  };

  const formatDateOnly = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU');
  };

  const formatDateRange = (startDate, endDate) => {
    const start = formatDateOnly(startDate);
    const end = formatDateOnly(endDate);
    if (!start && !end) return '';
    if (!end || start === end) return start || end;
    return `${start} — ${end}`;
  };

  const getStatusView = (status) => {
    return statusMap[status] || { label: status || 'Неизвестно', className: 'ui-chip' };
  };

  const getPaymentView = (paymentStatus) => {
    return paymentMap[paymentStatus] || {
      label: paymentStatus || 'Не указано',
      className: 'ui-chip',
    };
  };

  if (loading) {
    return (
      <div className="bookings-page">
        <div className="page-shell">
          <PageHeroSkeleton />
          <section className="bookings-hero__stats" style={{ marginBottom: '22px' }}>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </section>
          <BookingListSkeleton count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="bookings-page">
      <div className="page-shell">
        <section className="bookings-hero motion-rise">
          <div>
            <span className="home-hero__eyebrow">Bookings / Personal cabinet</span>
            <h1 className="bookings-hero__title">Мои бронирования</h1>
            <p className="bookings-hero__text">
              Здесь отображаются все ваши заявки на туры, их текущие статусы,
              стоимость и сведения по оформлению.
            </p>
          </div>

          <div className="bookings-hero__stats">
            <div className="compact-stat">
              <span>Всего</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="compact-stat">
              <span>Ожидают</span>
              <strong>{stats.pending}</strong>
            </div>
            <div className="compact-stat">
              <span>Подтверждены</span>
              <strong>{stats.confirmed}</strong>
            </div>
            <div className="compact-stat">
              <span>Завершены</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        </section>

        {error && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
            {error}
          </div>
        )}

        {sortedTourPlans.length > 0 && (
          <section className="custom-plans-section motion-fade">
            <div className="custom-plans-section__head">
              <div>
                <span className="home-hero__eyebrow">Individual tours</span>
                <h2>Индивидуальные планы</h2>
              </div>
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={() => navigate('/tour-constructor')}
              >
                Собрать новый
              </button>
            </div>

            <div className="custom-plans-grid">
              {sortedTourPlans.map((plan) => {
                const statusView = planStatusMap[plan.status] || planStatusMap.draft;
                return (
                  <article
                    key={plan.id}
                    className="custom-plan-card custom-plan-card--interactive"
                    role="button"
                    tabIndex={0}
                    aria-label={`Открыть индивидуальный план ${plan.title}`}
                    onClick={() => setSelectedTourPlan(plan)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedTourPlan(plan);
                      }
                    }}
                  >
                    <div className="custom-plan-card__head">
                      <span>План #{plan.id}</span>
                      <span className={statusView.className}>{statusView.label}</span>
                    </div>
                    <h3>{plan.title}</h3>
                    <p>{plan.route?.map((item) => item.city).join(' → ') || plan.country}</p>
                    <div className="custom-plan-card__meta">
                      <span>{plan.people_count} чел.</span>
                      <span>{plan.program?.length || 0} дней</span>
                      <span>{packageLabels[plan.package_type] || plan.package_type}</span>
                    </div>
                    <div className="custom-plan-card__price">
                      <span>Предварительная стоимость</span>
                      <div className="custom-plan-card__price-actions">
                        <strong>{formatMoney(plan.estimated_total)}</strong>
                        <span className="custom-plan-card__open">Открыть план</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {enrichedBookings.length === 0 ? (
          <section className="bookings-empty motion-fade">
            <div className="bookings-empty__inner">
              <span className="bookings-empty__icon">✈</span>
              <h2>У вас пока нет бронирований</h2>
              <p>
                Начните с выбора тура — после оформления заявки она появится в этом разделе.
              </p>
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={() => navigate('/tours')}
              >
                Перейти к турам
              </button>
            </div>
          </section>
        ) : (
          <section className="bookings-list">
            {enrichedBookings.map((booking, index) => {
              const statusView = getStatusView(booking.status);
              const paymentView = getPaymentView(booking.payment_status);

              return (
                <article
                  key={booking.id}
                  className="booking-card hover-lift motion-rise"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div className="booking-card__top">
                    <div className="booking-card__head">
                      <span className="booking-card__id">Бронирование #{booking.id}</span>
                      <h2 className="booking-card__title">
                        {booking.tour?.title || `Тур #${booking.tour_id}`}
                      </h2>
                      <p className="booking-card__location">
                        {booking.tour
                          ? `${booking.tour.city}, ${booking.tour.country}`
                          : 'Направление уточняется'}
                      </p>
                    </div>

                    <div className="booking-card__price-block">
                      <span className="booking-card__price-label">Итого</span>
                      <strong className="booking-card__price">
                        {formatMoney(booking.total_price)}
                      </strong>
                    </div>
                  </div>

                  <div className="booking-card__chips">
                    <span className={statusView.className}>{statusView.label}</span>
                    <span className={paymentView.className}>{paymentView.label}</span>

                    {booking.people_count ? (
                      <span className="ui-chip">{booking.people_count} чел.</span>
                    ) : null}

                    {booking.discount_amount && Number(booking.discount_amount) > 0 ? (
                      <span className="ui-chip ui-chip--accent">
                        Скидка {formatMoney(booking.discount_amount)}
                      </span>
                    ) : null}
                  </div>

                  <div className="booking-card__grid">
                    <div className="booking-card__info">
                      <span>Дата оформления</span>
                      <strong>{formatDate(booking.booking_date)}</strong>
                    </div>

                    <div className="booking-card__info">
                      <span>Статус заявки</span>
                      <strong>{statusView.label}</strong>
                    </div>

                    <div className="booking-card__info">
                      <span>Статус оплаты</span>
                      <strong>{paymentView.label}</strong>
                    </div>

                    <div className="booking-card__info">
                      <span>Способ оплаты</span>
                      <strong>{booking.payment_method || 'Не указан'}</strong>
                    </div>
                  </div>

                  <div className="booking-card__actions">
                    {booking.tour_id && (
                      <button
                        type="button"
                        className="site-button site-button--secondary"
                        onClick={() => navigate(`/tours/${booking.tour_id}`)}
                      >
                        Открыть тур
                      </button>
                    )}

                    <button
                      type="button"
                      className="site-button site-button--primary"
                      onClick={() => navigate('/notifications')}
                    >
                      К уведомлениям
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedTourPlan && (
        <>
          <div className="admin-drawer-backdrop" onClick={closeTourPlan} />
          <aside
            className="admin-drawer admin-tour-plan-drawer user-tour-plan-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-tour-plan-title"
          >
            <div className="admin-bookings-drawer__head">
              <div>
                <span className="home-hero__eyebrow">Индивидуальный тур</span>
                <h2 id="user-tour-plan-title" className="admin-bookings-drawer__title">
                  План #{selectedTourPlan.id}
                </h2>
                <p className="admin-bookings-drawer__subtitle">{selectedTourPlan.title}</p>
              </div>
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={closeTourPlan}
              >
                Закрыть
              </button>
            </div>

            <div className="admin-bookings-drawer__summary">
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Статус</span>
                <strong>
                  {(planStatusMap[selectedTourPlan.status] || planStatusMap.draft).label}
                </strong>
                <p>Обновлён: {formatDate(selectedTourPlan.updated_at || selectedTourPlan.created_at)}</p>
              </div>
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Маршрут</span>
                <strong>
                  {selectedTourPlan.route?.map((item) => item.city).join(' → ')
                    || selectedTourPlan.country}
                </strong>
                <p>{selectedTourPlan.program?.length || 0} дней · {selectedTourPlan.people_count} чел.</p>
              </div>
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Пакет</span>
                <strong>
                  {packageLabels[selectedTourPlan.package_type] || selectedTourPlan.package_type}
                </strong>
                <p>
                  {paceLabels[selectedTourPlan.pace] || selectedTourPlan.pace}
                  {' · '}
                  {interestLabels[selectedTourPlan.interest] || selectedTourPlan.interest}
                </p>
              </div>
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Стоимость</span>
                <strong>{formatMoney(selectedTourPlan.estimated_total)}</strong>
                <p>
                  Туры: {formatMoney(selectedTourPlan.base_price)}
                  {' · '}
                  Услуги: {formatMoney(selectedTourPlan.services_price)}
                </p>
              </div>
            </div>

            <div className="admin-tour-plan-detail">
              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Параметры поездки</h3>
                </div>
                <div className="admin-tour-plan-facts">
                  <div><span>Страна</span><strong>{selectedTourPlan.country}</strong></div>
                  <div><span>Туристы</span><strong>{selectedTourPlan.people_count} чел.</strong></div>
                  <div>
                    <span>Темп</span>
                    <strong>{paceLabels[selectedTourPlan.pace] || selectedTourPlan.pace}</strong>
                  </div>
                  <div>
                    <span>Интерес</span>
                    <strong>{interestLabels[selectedTourPlan.interest] || selectedTourPlan.interest}</strong>
                  </div>
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Пакет и услуги</h3>
                  <span>{packageLabels[selectedTourPlan.package_type] || selectedTourPlan.package_type}</span>
                </div>
                <div className="admin-tour-plan-services">
                  <div>
                    <span>Питание</span>
                    <strong>{mealLabels[selectedTourPlan.services?.meal_plan] || 'Не указано'}</strong>
                  </div>
                  <div>
                    <span>Размещение</span>
                    <strong>{hotelLabels[selectedTourPlan.services?.hotel_level] || 'Не указано'}</strong>
                  </div>
                  <div>
                    <span>Трансфер</span>
                    <strong>{transferLabels[selectedTourPlan.services?.transfer] || 'Не указано'}</strong>
                  </div>
                </div>
                <div className="admin-tour-plan-service-toggles">
                  {optionalServices.map(([key, label]) => {
                    const enabled = Boolean(selectedTourPlan.services?.[key]);
                    return (
                      <span key={key} className={enabled ? 'is-included' : 'is-excluded'}>
                        <b>{enabled ? 'Включено' : 'Не включено'}</b>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Маршрут и базовые туры</h3>
                  <span>{selectedTourPlan.route?.length || 0} этапов</span>
                </div>
                <div className="admin-tour-plan-route">
                  {(selectedTourPlan.route || []).map((item, index) => (
                    <article key={`${item.city}-${item.order}-${index}`}>
                      <span>Этап {item.order || index + 1}</span>
                      <strong>{item.city}</strong>
                      <p>{item.tour_title || 'Тур-основа не выбран'}</p>
                      <div className="admin-tour-plan-route__meta">
                        <small>{item.tour_duration || 0} дней</small>
                        {item.tour_price !== null && item.tour_price !== undefined && (
                          <small>{formatMoney(item.tour_price)} за человека</small>
                        )}
                        {(item.tour_start_date || item.tour_end_date) && (
                          <small>{formatDateRange(item.tour_start_date, item.tour_end_date)}</small>
                        )}
                      </div>
                      {item.customization && (
                        <div className="admin-tour-plan-route__note">
                          <b>Пожелания к туру:</b> {item.customization}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Мероприятия</h3>
                  <span>{selectedTourPlan.activities?.length || 0}</span>
                </div>
                {selectedTourPlan.activities?.length ? (
                  <div className="admin-tour-plan-activities">
                    {selectedTourPlan.activities.map((activity, index) => (
                      <article key={`${activity.title}-${index}`}>
                        <span>{activity.activity_type || 'Мероприятие'}</span>
                        <strong>{activity.title}</strong>
                        <small>{activity.city}</small>
                        {activity.description && <p>{activity.description}</p>}
                        {(activity.start_date || activity.end_date) && (
                          <small>{formatDateRange(activity.start_date, activity.end_date)}</small>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="admin-tour-plan-empty">Дополнительные мероприятия не выбраны.</p>
                )}
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Программа по дням</h3>
                  <span>{selectedTourPlan.program?.length || 0} дней</span>
                </div>
                <div className="admin-tour-plan-program">
                  {(selectedTourPlan.program || []).map((day, index) => (
                    <article key={`${day.day}-${day.city}-${index}`}>
                      <div>
                        <span>День</span>
                        <strong>{day.day || index + 1}</strong>
                      </div>
                      <div>
                        <small>{day.city}</small>
                        <strong>{day.title}</strong>
                        <p>{day.description || 'Описание не заполнено'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {selectedTourPlan.special_requests && (
                <section>
                  <div className="admin-tour-plan-detail__head">
                    <h3>Особые пожелания</h3>
                  </div>
                  <p className="admin-custom-plan__request">
                    {selectedTourPlan.special_requests}
                  </p>
                </section>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default MyBookings;
