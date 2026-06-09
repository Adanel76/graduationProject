import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useToast } from '../components/ToastContext';
import { PageHeroSkeleton, StatSkeleton } from '../components/Skeletons';

const bookingStatusMap = {
  pending: { label: 'Ожидание', className: 'ui-chip ui-chip--warning' },
  confirmed: { label: 'Подтверждено', className: 'ui-chip ui-chip--success' },
  completed: { label: 'Завершено', className: 'ui-chip ui-chip--accent' },
  cancelled: { label: 'Отменено', className: 'ui-chip ui-chip--danger' },
};

const paymentStatusMap = {
  pending: { label: 'Ожидает оплаты', className: 'ui-chip ui-chip--warning' },
  paid: { label: 'Оплачено', className: 'ui-chip ui-chip--success' },
  failed: { label: 'Ошибка оплаты', className: 'ui-chip ui-chip--danger' },
};

const tourPlanStatusMap = {
  draft: 'Черновик',
  submitted: 'Отправлен',
  in_review: 'На рассмотрении',
  approved: 'Согласован',
  rejected: 'Нужны изменения',
};

const packageTypeMap = {
  standard: 'Базовый',
  comfort: 'Комфорт',
  all_inclusive: 'Всё включено',
  custom: 'Свой пакет',
};

const paceTypeMap = {
  relaxed: 'Спокойный',
  balanced: 'Сбалансированный',
  active: 'Активный',
};

const interestTypeMap = {
  culture: 'Культура',
  nature: 'Природа',
  family: 'Семейный отдых',
  gastro: 'Гастрономия',
};

const mealPlanMap = {
  none: 'Без питания',
  breakfast: 'Завтраки',
  half_board: 'Завтрак и ужин',
  full_board: 'Трёхразовое питание',
  all_inclusive: 'Всё включено',
};

const hotelLevelMap = {
  base: 'Базовое из тура',
  comfort: 'Комфорт',
  premium: 'Премиум',
};

const transferTypeMap = {
  none: 'Не включён',
  group: 'Групповой',
  individual: 'Индивидуальный',
};

const optionalServiceMap = [
  ['insurance', 'Туристическая страховка'],
  ['guide', 'Персональный гид'],
  ['excursions', 'Пакет экскурсий'],
  ['priority_support', 'Приоритетная поддержка'],
];

const AdminBookings = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [bookings, setBookings] = useState([]);
  const [tours, setTours] = useState([]);
  const [users, setUsers] = useState([]);
  const [tourPlans, setTourPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tourFilter, setTourFilter] = useState('');

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedTourPlan, setSelectedTourPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tourPlanSaving, setTourPlanSaving] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [tourPlanDrawerError, setTourPlanDrawerError] = useState('');
  const [statusForm, setStatusForm] = useState({
    status: 'pending',
    note: '',
  });
  const [tourPlanStatus, setTourPlanStatus] = useState('submitted');

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const [meResponse, bookingsResponse, toursResponse, usersResponse, plansResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getBookings(),
        tourismAPI.getTours({ limit: 300, include_archived: true }),
        tourismAPI.getAllUsers(),
        tourismAPI.getTourPlans(),
      ]);

      const me = meResponse.data;

      if (!['admin', 'manager'].includes(me.role)) {
        navigate('/profile');
        return;
      }

      setBookings(bookingsResponse.data || []);
      setTours(toursResponse.data || []);
      setUsers(usersResponse.data || []);
      setTourPlans(plansResponse.data || []);
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);

      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (error.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setPageError('Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const closeDrawer = useCallback(() => {
    setSelectedBooking(null);
    setDrawerError('');
    setStatusForm({
      status: 'pending',
      note: '',
    });
  }, []);

  const closeTourPlanDrawer = useCallback(() => {
    setSelectedTourPlan(null);
    setTourPlanDrawerError('');
    setTourPlanStatus('submitted');
  }, []);

  useEffect(() => {
    if (!selectedBooking && !selectedTourPlan) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedBooking) closeDrawer();
        if (selectedTourPlan) closeTourPlanDrawer();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBooking, selectedTourPlan, closeDrawer, closeTourPlanDrawer]);

  const enrichedBookings = useMemo(() => {
    return [...bookings]
      .map((booking) => {
        const tour = tours.find((item) => item.id === booking.tour_id);
        const user = users.find((item) => item.id === booking.user_id);

        return {
          ...booking,
          tour,
          user,
        };
      })
      .sort((a, b) => {
        const aDate = new Date(a.booking_date || a.created_at || 0).getTime();
        const bDate = new Date(b.booking_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });
  }, [bookings, tours, users]);

  const filteredBookings = useMemo(() => {
    return enrichedBookings.filter((booking) => {
      const text = [
        booking.id,
        booking.user?.first_name,
        booking.user?.last_name,
        booking.user?.email,
        booking.tour?.title,
        booking.tour?.country,
        booking.tour?.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesStatus = statusFilter ? booking.status === statusFilter : true;
      const matchesTour = tourFilter ? String(booking.tour_id) === String(tourFilter) : true;

      return matchesSearch && matchesStatus && matchesTour;
    });
  }, [enrichedBookings, search, statusFilter, tourFilter]);

  const stats = useMemo(() => {
    return {
      total: enrichedBookings.length,
      pending: enrichedBookings.filter((item) => item.status === 'pending').length,
      confirmed: enrichedBookings.filter((item) => item.status === 'confirmed').length,
      completed: enrichedBookings.filter((item) => item.status === 'completed').length,
      cancelled: enrichedBookings.filter((item) => item.status === 'cancelled').length,
    };
  }, [enrichedBookings]);

  const getBookingStatusView = (status) => {
    return bookingStatusMap[status] || {
      label: status || 'Неизвестно',
      className: 'ui-chip',
    };
  };

  const getPaymentStatusView = (status) => {
    return paymentStatusMap[status] || {
      label: status || 'Не указано',
      className: 'ui-chip',
    };
  };

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU');
  };

  const formatDate = (value) => {
    if (!value) return 'Дата не указана';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Дата не указана';
    return date.toLocaleDateString('ru-RU');
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Даты не указаны';
    if (!endDate) return formatDate(startDate);
    return `${formatDate(startDate)} — ${formatDate(endDate)}`;
  };

  const getUserName = (booking) => {
    if (!booking.user) return `Пользователь #${booking.user_id}`;
    const fullName = `${booking.user.first_name || ''} ${booking.user.last_name || ''}`.trim();
    return fullName || booking.user.email || `Пользователь #${booking.user_id}`;
  };

  const getTourName = (booking) => {
    if (!booking.tour) return `Тур #${booking.tour_id}`;
    return booking.tour.title;
  };

  const openDrawer = (booking) => {
    setDrawerError('');
    setSelectedBooking(booking);
    setStatusForm({
      status: booking.status || 'pending',
      note: '',
    });
  };

  const getTourPlanClient = useCallback((plan) => {
    const client = users.find((user) => user.id === plan?.user_id);
    const firstName = plan?.user_first_name || client?.first_name || '';
    const lastName = plan?.user_last_name || client?.last_name || '';
    return {
      ...client,
      first_name: firstName,
      last_name: lastName,
      email: plan?.user_email || client?.email || '',
      phone: plan?.user_phone || client?.phone || '',
      name: `${firstName} ${lastName}`.trim()
        || plan?.user_email
        || client?.email
        || `Пользователь #${plan?.user_id}`,
    };
  }, [users]);

  const openTourPlanDrawer = (plan) => {
    setTourPlanDrawerError('');
    setSelectedTourPlan(plan);
    setTourPlanStatus(plan.status || 'submitted');
  };

  const handleSave = async () => {
    if (!selectedBooking) return;

    try {
      setSaving(true);
      setDrawerError('');

      const response = await tourismAPI.updateBookingStatus(selectedBooking.id, {
        status: statusForm.status,
        note: statusForm.note,
      });

      const updatedBooking = response.data;

      setBookings((prev) =>
        prev.map((item) => (item.id === updatedBooking.id ? updatedBooking : item))
      );

      const updatedEnriched = {
        ...updatedBooking,
        tour: tours.find((item) => item.id === updatedBooking.tour_id),
        user: users.find((item) => item.id === updatedBooking.user_id),
      };

      setSelectedBooking(updatedEnriched);
      setStatusForm((prev) => ({ ...prev, note: '' }));
      toast.success('Статус заявки обновлён');
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      setDrawerError(
        error.response?.data?.detail || 'Не удалось обновить статус заявки'
      );
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTourFilter('');
  };

  const handleTourPlanStatus = async () => {
    if (!selectedTourPlan) return;

    try {
      setTourPlanSaving(true);
      setTourPlanDrawerError('');
      const response = await tourismAPI.updateTourPlanStatus(selectedTourPlan.id, {
        status: tourPlanStatus,
      });
      setTourPlans((prev) =>
        prev.map((plan) => (plan.id === selectedTourPlan.id ? response.data : plan))
      );
      setSelectedTourPlan(response.data);
      setTourPlanStatus(response.data.status);
      window.dispatchEvent(new Event('notifications-updated'));
      toast.success('Статус индивидуального плана обновлён');
    } catch (error) {
      console.error('Ошибка обновления индивидуального плана:', error);
      setTourPlanDrawerError(
        error.response?.data?.detail || 'Не удалось обновить статус индивидуального тура'
      );
    } finally {
      setTourPlanSaving(false);
    }
  };

  const selectedTourPlanClient = selectedTourPlan
    ? getTourPlanClient(selectedTourPlan)
    : null;
  const selectedTourPlanServices = selectedTourPlan?.services || {};
  const selectedTourPlanRoute = selectedTourPlan?.route || [];
  const selectedTourPlanActivities = selectedTourPlan?.activities || [];
  const selectedTourPlanProgram = selectedTourPlan?.program || [];

  if (loading) {
    return (
      <div className="admin-bookings-page">
        <div className="page-shell">
          <PageHeroSkeleton />
          <section className="admin-bookings-hero__stats" style={{ marginBottom: '22px' }}>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </section>

          <section className="admin-bookings-toolbar">
            <div className="admin-bookings-toolbar__left">
              <div className="skeleton" style={{ width: '360px', height: '46px', borderRadius: '14px' }} />
              <div className="skeleton" style={{ width: '220px', height: '46px', borderRadius: '14px' }} />
              <div className="skeleton" style={{ width: '220px', height: '46px', borderRadius: '14px' }} />
            </div>

            <div className="admin-bookings-toolbar__right">
              <div className="skeleton" style={{ width: '110px', height: '44px', borderRadius: '14px' }} />
              <div className="skeleton" style={{ width: '110px', height: '44px', borderRadius: '14px' }} />
            </div>
          </section>

          <section className="admin-table-shell">
            <div className="skeleton" style={{ width: '100%', height: '420px', borderRadius: '22px' }} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-bookings-page">
      <div className="page-shell">
        <section className="admin-bookings-hero motion-rise">
          <div>
            <span className="home-hero__eyebrow">Bookings / Operations</span>
            <h1 className="admin-bookings-hero__title">Управление заявками</h1>
            <p className="admin-bookings-hero__text">
              Операционная панель для менеджера и администратора: поиск, фильтрация,
              контроль статусов и быстрое обновление заявок.
            </p>
          </div>

          <div className="admin-bookings-hero__stats">
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
            <div className="compact-stat">
              <span>Отменены</span>
              <strong>{stats.cancelled}</strong>
            </div>
          </div>
        </section>

        <section className="admin-bookings-toolbar motion-fade">
          <div className="admin-bookings-toolbar__left">
            <input
              type="text"
              className="admin-table-search"
              placeholder="Поиск по клиенту, email, туру, направлению..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="admin-bookings-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Все статусы</option>
              <option value="pending">Ожидание</option>
              <option value="confirmed">Подтверждено</option>
              <option value="completed">Завершено</option>
              <option value="cancelled">Отменено</option>
            </select>

            <select
              className="admin-bookings-select"
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
            >
              <option value="">Все туры</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.title}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-bookings-toolbar__right">
            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={clearFilters}
            >
              Сбросить
            </button>

            <button
              type="button"
              className="site-button site-button--primary"
              onClick={loadPage}
            >
              Обновить
            </button>
          </div>
        </section>

        {pageError && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
            {pageError}
          </div>
        )}

        {tourPlans.length > 0 && (
          <section className="admin-custom-plans motion-fade">
            <div className="admin-custom-plans__head">
              <div>
                <span className="home-hero__eyebrow">Custom tour requests</span>
                <h2>Индивидуальные туры</h2>
              </div>
              <strong>{tourPlans.length}</strong>
            </div>

            <div className="admin-custom-plans__list">
              {tourPlans.map((plan) => {
                const client = getTourPlanClient(plan);

                return (
                  <article key={plan.id} className="admin-custom-plan">
                    <div className="admin-custom-plan__summary">
                      <div>
                        <span>План #{plan.id}</span>
                        <strong>{plan.title}</strong>
                        <small>
                          {client.name} · {plan.people_count} чел. · {plan.program?.length || 0} дн.
                        </small>
                        <p className="admin-custom-plan__route">
                          {plan.route?.map((item) => item.city).join(' → ') || plan.country}
                        </p>
                      </div>
                      <div className="admin-custom-plan__summary-actions">
                        <strong>{formatMoney(plan.estimated_total)}</strong>
                        <span className="ui-chip">
                          {tourPlanStatusMap[plan.status] || plan.status}
                        </span>
                        <button
                          type="button"
                          className="site-button site-button--secondary"
                          onClick={() => openTourPlanDrawer(plan)}
                        >
                          Открыть заявку
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="admin-table-shell motion-fade">
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Клиент</th>
                  <th>Тур</th>
                  <th>Дата</th>
                  <th>Люди</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Оплата</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="admin-bookings-empty-row">
                        Заявки по заданным фильтрам не найдены
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => {
                    const statusView = getBookingStatusView(booking.status);
                    const paymentView = getPaymentStatusView(booking.payment_status);

                    return (
                      <tr key={booking.id}>
                        <td>
                          <strong>#{booking.id}</strong>
                        </td>

                        <td>
                          <div className="admin-bookings-person">
                            <strong>{getUserName(booking)}</strong>
                            <span>{booking.user?.email || '—'}</span>
                          </div>
                        </td>

                        <td>
                          <div className="admin-bookings-tour">
                            <strong>{getTourName(booking)}</strong>
                            <span>
                              {booking.tour
                                ? `${booking.tour.city}, ${booking.tour.country}`
                                : '—'}
                            </span>
                          </div>
                        </td>

                        <td>{formatDateTime(booking.booking_date)}</td>
                        <td>{booking.people_count || '—'}</td>
                        <td>{formatMoney(booking.total_price)}</td>

                        <td>
                          <span className={statusView.className}>{statusView.label}</span>
                        </td>

                        <td>
                          <span className={paymentView.className}>{paymentView.label}</span>
                        </td>

                        <td>
                          <div className="admin-bookings-actions">
                            <button
                              type="button"
                              className="site-button site-button--secondary"
                              onClick={() => openDrawer(booking)}
                            >
                              Открыть
                            </button>

                            {booking.tour_id && (
                              <button
                                type="button"
                                className="site-button site-button--ghost"
                                onClick={() => navigate(`/tours/${booking.tour_id}`)}
                              >
                                Тур
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedBooking && (
        <>
          <div className="admin-drawer-backdrop" onClick={closeDrawer} />

          <aside className="admin-drawer">
            <div className="admin-bookings-drawer__head">
              <div>
                <span className="home-hero__eyebrow">Booking detail</span>
                <h2 className="admin-bookings-drawer__title">
                  Заявка #{selectedBooking.id}
                </h2>
                <p className="admin-bookings-drawer__subtitle">
                  {getUserName(selectedBooking)} — {getTourName(selectedBooking)}
                </p>
              </div>

              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={closeDrawer}
              >
                Закрыть
              </button>
            </div>

            <div className="admin-bookings-drawer__summary">
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Клиент</span>
                <strong>{getUserName(selectedBooking)}</strong>
                <p>{selectedBooking.user?.email || 'Email не найден'}</p>
                <p>
                  Телефон: {selectedBooking.user?.phone || selectedBooking.user_phone || 'Не указан'}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Тур</span>
                <strong>{getTourName(selectedBooking)}</strong>
                <p>
                  {selectedBooking.tour
                    ? `${selectedBooking.tour.city}, ${selectedBooking.tour.country}`
                    : 'Тур недоступен'}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Стоимость</span>
                <strong>{formatMoney(selectedBooking.total_price)}</strong>
                <p>
                  Людей: {selectedBooking.people_count || '—'}
                  {selectedBooking.discount_amount
                    ? ` • Скидка: ${formatMoney(selectedBooking.discount_amount)}`
                    : ''}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Оформлено</span>
                <strong>{formatDateTime(selectedBooking.booking_date)}</strong>
                <p>Способ оплаты: {selectedBooking.payment_method || 'Не указан'}</p>
              </div>
            </div>

            <div className="admin-bookings-drawer__status-row">
              <span className={getBookingStatusView(selectedBooking.status).className}>
                {getBookingStatusView(selectedBooking.status).label}
              </span>

              <span className={getPaymentStatusView(selectedBooking.payment_status).className}>
                {getPaymentStatusView(selectedBooking.payment_status).label}
              </span>
            </div>

            <div className="admin-bookings-drawer__form">
              <div className="ui-field">
                <label htmlFor="booking-status">Новый статус</label>
                <select
                  id="booking-status"
                  value={statusForm.status}
                  onChange={(e) =>
                    setStatusForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="pending">Ожидание</option>
                  <option value="confirmed">Подтверждено</option>
                  <option value="completed">Завершено</option>
                  <option value="cancelled">Отменено</option>
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="booking-note">Комментарий к изменению</label>
                <textarea
                  id="booking-note"
                  rows="5"
                  placeholder="Например: подтверждено после звонка клиенту"
                  value={statusForm.note}
                  onChange={(e) =>
                    setStatusForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </div>

              {drawerError && (
                <div className="detail-alert detail-alert--error">{drawerError}</div>
              )}

              <div className="admin-bookings-drawer__actions">
                <button
                  type="button"
                  className="site-button site-button--secondary"
                  onClick={closeDrawer}
                  disabled={saving}
                >
                  Отмена
                </button>

                <button
                  type="button"
                  className="site-button site-button--primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Сохранение...' : 'Сохранить статус'}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {selectedTourPlan && selectedTourPlanClient && (
        <>
          <div className="admin-drawer-backdrop" onClick={closeTourPlanDrawer} />

          <aside className="admin-drawer admin-tour-plan-drawer">
            <div className="admin-bookings-drawer__head">
              <div>
                <span className="home-hero__eyebrow">Custom tour detail</span>
                <h2 className="admin-bookings-drawer__title">
                  Индивидуальная заявка #{selectedTourPlan.id}
                </h2>
                <p className="admin-bookings-drawer__subtitle">
                  {selectedTourPlanClient.name} — {selectedTourPlan.title}
                </p>
              </div>

              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={closeTourPlanDrawer}
              >
                Закрыть
              </button>
            </div>

            <div className="admin-bookings-drawer__summary">
              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Клиент</span>
                <strong>{selectedTourPlanClient.name}</strong>
                <p>{selectedTourPlanClient.email || 'Email не найден'}</p>
                <p>Телефон: {selectedTourPlanClient.phone || 'Не указан'}</p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Заявка</span>
                <strong>{selectedTourPlan.title}</strong>
                <p>
                  Создана: {formatDateTime(selectedTourPlan.created_at)}
                </p>
                {selectedTourPlan.updated_at && (
                  <p>Обновлена: {formatDateTime(selectedTourPlan.updated_at)}</p>
                )}
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Маршрут</span>
                <strong>
                  {selectedTourPlanRoute.map((item) => item.city).join(' → ')
                    || selectedTourPlan.country}
                </strong>
                <p>
                  {selectedTourPlanProgram.length} дней · {selectedTourPlan.people_count} чел.
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Бюджет клиента</span>
                <strong>
                  {selectedTourPlan.budget
                    ? formatMoney(selectedTourPlan.budget)
                    : 'Не ограничен'}
                </strong>
                <p>
                  {!selectedTourPlan.budget
                    ? 'Пользователь не задавал верхний предел'
                    : selectedTourPlan.estimated_total > selectedTourPlan.budget
                      ? 'Расчёт выше указанного бюджета'
                      : 'Расчёт в пределах указанного бюджета'}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Расчёт стоимости</span>
                <strong>{formatMoney(selectedTourPlan.estimated_total)}</strong>
                <p>
                  Основа: {formatMoney(selectedTourPlan.base_price)}
                  {' · '}
                  Сервис: {formatMoney(selectedTourPlan.services_price)}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-bookings-drawer__label">Пакет</span>
                <strong>{packageTypeMap[selectedTourPlan.package_type] || selectedTourPlan.package_type}</strong>
                <p>
                  {paceTypeMap[selectedTourPlan.pace] || selectedTourPlan.pace}
                  {' · '}
                  {interestTypeMap[selectedTourPlan.interest] || selectedTourPlan.interest}
                </p>
              </div>
            </div>

            <div className="admin-bookings-drawer__status-row">
              <span className="ui-chip">
                {tourPlanStatusMap[selectedTourPlan.status] || selectedTourPlan.status}
              </span>
            </div>

            <div className="admin-tour-plan-detail">
              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Параметры поездки</h3>
                  <span>Все вводные клиента</span>
                </div>
                <div className="admin-tour-plan-facts">
                  <div>
                    <span>Страна</span>
                    <strong>{selectedTourPlan.country}</strong>
                  </div>
                  <div>
                    <span>Туристы</span>
                    <strong>{selectedTourPlan.people_count} чел.</strong>
                  </div>
                  <div>
                    <span>Темп</span>
                    <strong>{paceTypeMap[selectedTourPlan.pace] || selectedTourPlan.pace}</strong>
                  </div>
                  <div>
                    <span>Интерес</span>
                    <strong>{interestTypeMap[selectedTourPlan.interest] || selectedTourPlan.interest}</strong>
                  </div>
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Пакет и услуги</h3>
                  <span>{packageTypeMap[selectedTourPlan.package_type] || selectedTourPlan.package_type}</span>
                </div>
                <div className="admin-tour-plan-services">
                  <div>
                    <span>Питание</span>
                    <strong>
                      {mealPlanMap[selectedTourPlanServices.meal_plan]
                        || selectedTourPlanServices.meal_plan
                        || 'Не указано'}
                    </strong>
                  </div>
                  <div>
                    <span>Размещение</span>
                    <strong>
                      {hotelLevelMap[selectedTourPlanServices.hotel_level]
                        || selectedTourPlanServices.hotel_level
                        || 'Не указано'}
                    </strong>
                  </div>
                  <div>
                    <span>Трансфер</span>
                    <strong>
                      {transferTypeMap[selectedTourPlanServices.transfer]
                        || selectedTourPlanServices.transfer
                        || 'Не указано'}
                    </strong>
                  </div>
                </div>
                <div className="admin-tour-plan-service-toggles">
                  {optionalServiceMap.map(([key, label]) => {
                    const enabled = Boolean(selectedTourPlanServices[key]);
                    return (
                      <span
                        key={key}
                        className={enabled ? 'is-included' : 'is-excluded'}
                      >
                        <b>{enabled ? 'Включено' : 'Не включено'}</b>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Базовые туры и настройки</h3>
                  <span>{selectedTourPlanRoute.length} этапов</span>
                </div>
                <div className="admin-tour-plan-route">
                  {selectedTourPlanRoute.map((item, index) => {
                    const currentTour = tours.find(
                      (tour) => Number(tour.id) === Number(item.tour_id)
                    );
                    const tourPrice = item.tour_price ?? currentTour?.price;
                    const tourStartDate = item.tour_start_date || currentTour?.start_date;
                    const tourEndDate = item.tour_end_date || currentTour?.end_date;

                    return (
                      <article key={`${item.city}-${item.order}-${index}`}>
                        <span>Этап {item.order || index + 1}</span>
                        <strong>{item.city}</strong>
                        <p>{item.tour_title || currentTour?.title || 'Тур-основа не выбран'}</p>
                        <div className="admin-tour-plan-route__meta">
                          <small>{item.tour_duration || currentTour?.duration || 0} дней</small>
                          {tourPrice !== null && tourPrice !== undefined && (
                            <small>{formatMoney(tourPrice)} за человека</small>
                          )}
                          {(tourStartDate || tourEndDate) && (
                            <small>{formatDateRange(tourStartDate, tourEndDate)}</small>
                          )}
                        </div>
                        {item.customization && (
                          <div className="admin-tour-plan-route__note">
                            <b>Пожелания к туру:</b> {item.customization}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="admin-tour-plan-detail__head">
                  <h3>Мероприятия</h3>
                  <span>{selectedTourPlanActivities.length}</span>
                </div>
                {selectedTourPlanActivities.length ? (
                  <div className="admin-tour-plan-activities">
                    {selectedTourPlanActivities.map((activity, index) => (
                      <article key={`${activity.title}-${index}`}>
                        <span>{activity.activity_type || 'Мероприятие'}</span>
                        <strong>{activity.title}</strong>
                        <small>{activity.city}</small>
                        {activity.description && <p>{activity.description}</p>}
                        {(activity.start_date || activity.end_date) && (
                          <small>{formatDateRange(activity.start_date, activity.end_date)}</small>
                        )}
                        {activity.source && (
                          <small>
                            Источник: {activity.source === 'event' ? 'мероприятие' : 'программа тура'}
                            {activity.source_id ? ` #${activity.source_id}` : ''}
                          </small>
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
                  <span>{selectedTourPlanProgram.length} дней</span>
                </div>
                <div className="admin-tour-plan-program">
                  {selectedTourPlanProgram.map((day, index) => (
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

            <div className="admin-bookings-drawer__form">
              <div className="ui-field">
                <label htmlFor="tour-plan-status">Новый статус</label>
                <select
                  id="tour-plan-status"
                  value={tourPlanStatus}
                  onChange={(event) => setTourPlanStatus(event.target.value)}
                >
                  <option value="draft">Черновик</option>
                  <option value="submitted">Отправлен</option>
                  <option value="in_review">На рассмотрении</option>
                  <option value="approved">Согласован</option>
                  <option value="rejected">Нужны изменения</option>
                </select>
              </div>

              {tourPlanDrawerError && (
                <div className="detail-alert detail-alert--error">{tourPlanDrawerError}</div>
              )}

              <div className="admin-bookings-drawer__actions">
                <button
                  type="button"
                  className="site-button site-button--secondary"
                  onClick={closeTourPlanDrawer}
                  disabled={tourPlanSaving}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="site-button site-button--primary"
                  onClick={handleTourPlanStatus}
                  disabled={tourPlanSaving}
                >
                  {tourPlanSaving ? 'Сохранение...' : 'Сохранить статус'}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default AdminBookings;
