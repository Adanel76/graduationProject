import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { tourismAPI } from '../services/api';

const ADMIN_OVERVIEW_CACHE_KEY = 'adminDashboardOverview';

const readCachedOverview = (userId) => {
  if (!userId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(`${ADMIN_OVERVIEW_CACHE_KEY}:${userId}`));
    return cached?.overview || null;
  } catch (error) {
    return null;
  }
};

const writeCachedOverview = (userId, overview) => {
  if (!userId || !overview) return;
  try {
    localStorage.setItem(
      `${ADMIN_OVERVIEW_CACHE_KEY}:${userId}`,
      JSON.stringify({ overview, cached_at: Date.now() })
    );
  } catch (error) {
    // Кэш ускоряет повторный вход, но не должен мешать работе панели.
  }
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const cachedOverview = readCachedOverview(currentUser?.id);

  const [dashboard, setDashboard] = useState(() => (
    cachedOverview ? { overview: cachedOverview } : null
  ));
  const [loading, setLoading] = useState(() => !cachedOverview);
  const [error, setError] = useState('');

  const role = currentUser?.role || null;
  const isStaff = ['admin', 'manager', 'analyst'].includes(role);

  const loadDashboard = useCallback(async () => {
    if (!isStaff) return;

    try {
      setError('');
      const response = await tourismAPI.getAnalyticsOverview();
      const overviewData = response?.data || null;
      if (!overviewData) throw new Error('Пустая сводка панели');

      setDashboard({ overview: overviewData });
      writeCachedOverview(currentUser?.id, overviewData);
    } catch (err) {
      console.error('Ошибка загрузки панели персонала:', err);

      if (err?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUserCache');
        navigate('/login');
        return;
      }

      if (err?.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setError('Не удалось загрузить данные панели');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, isStaff, navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!isStaff) return undefined;

    const intervalId = window.setInterval(async () => {
      try {
        const response = await tourismAPI.getAnalyticsOverview();
        const overviewData = response?.data || null;
        if (!overviewData) return;
        setDashboard({ overview: overviewData });
        writeCachedOverview(currentUser?.id, overviewData);
      } catch (err) {
        console.error('Ошибка обновления онлайн-метрик:', err);
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [currentUser?.id, isStaff]);

  const overview = useMemo(
    () => dashboard?.overview || {
      total_users: 0,
      online_users: 0,
      total_tours: 0,
      total_bookings: 0,
      confirmed_bookings: 0,
      pending_bookings: 0,
      cancelled_bookings: 0,
      total_revenue: 0,
      average_rating: 0,
      reviews_count: 0,
    },
    [dashboard]
  );

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  if (!isStaff) return null;

  const primaryActions = [
    (role === 'admin' || role === 'manager') && { title: 'Бронирования', desc: 'Заявки клиентов и статусы оплат', icon: '🧾', metric: overview.pending_bookings || 0, label: 'ожидают', to: '/admin/bookings', highlight: true },
    (role === 'admin' || role === 'manager') && { title: 'Туры', desc: 'Каталог, цены, даты и свободные места', icon: '✈', metric: overview.active_tours || 0, label: 'активных', to: '/admin/tours' },
    (role === 'admin' || role === 'analyst') && { title: 'Аналитика', desc: 'Выручка, спрос, рейтинг, CSV и контроль данных', icon: '📊', metric: formatMoney(overview.total_revenue || 0), label: 'выручка', to: '/admin/analytics' },
  ].filter(Boolean);

  const secondaryActions = [
    (role === 'admin' || role === 'manager') && { title: 'Мероприятия', desc: 'Новости, акции и события', icon: '🗓', to: '/admin/events' },
    role === 'admin' && { title: 'Пользователи', desc: 'Роли и аккаунты', icon: '👥', to: '/admin/users' },
    (role === 'admin' || role === 'manager') && { title: 'Отзывы', desc: 'Модерация оценок', icon: '★', to: '/admin/reviews' },
    (role === 'admin' || role === 'manager') && { title: 'Отчёты', desc: 'Экспорт CSV/XLSX', icon: '📁', to: '/admin/reports' },
    (role === 'admin' || role === 'analyst') && { title: 'CSV-центр', desc: 'Загрузка, проверка и управление датасетами', icon: '🧬', to: '/admin/data' },
    { title: 'Уведомления', desc: 'Системные сообщения', icon: '🔔', to: '/notifications' },
  ].filter(Boolean);

  return (
    <div className="page-shell admin-home-page admin-home-page--redesigned">
      {error && (
        <div className="profile-message profile-message--error admin-dashboard-notice">
          {error}. Показана последняя доступная сводка.
        </div>
      )}
      <section className="admin-command-hero">
        <div className="admin-command-hero__content">
          <span className="home-hero__eyebrow">
            {loading ? 'Обновляем данные' : 'Панель управления'}
          </span>
          <h1>Центр управления Travel Agency</h1>
          <p>
            Здесь находится только служебная информация: заявки клиентов, каталог туров,
            аналитика, пользователи и отчёты. Личные данные сотрудника вынесены в профиль.
          </p>
        </div>

        <aside className="admin-platform-card admin-platform-card--online">
          <span className="admin-platform-card__label">Пользователи системы</span>
          <strong>{overview.online_users || 0}</strong>
          <p>Активны за последние 90 секунд. Если пользователь закрыл сайт, показатель быстро уменьшится.</p>
          <div className="admin-platform-card__metrics admin-platform-card__metrics--three">
            <div><span>{overview.total_users || 0}</span><small>всего</small></div>
            <div><span>{overview.total_bookings || 0}</span><small>заявок</small></div>
            <div><span>{overview.total_tours || 0}</span><small>туров</small></div>
          </div>
        </aside>
      </section>

      <section className="admin-priority-grid">
        {primaryActions.map((action) => (
          <button key={action.title} type="button" className={`admin-priority-card ${action.highlight ? 'admin-priority-card--highlight' : ''}`} onClick={() => navigate(action.to)}>
            <div className="admin-priority-card__top"><span>{action.icon}</span><small>{action.label}</small></div>
            <strong>{action.metric}</strong>
            <h3>{action.title}</h3>
            <p>{action.desc}</p>
          </button>
        ))}
      </section>

      <section className="admin-home-stats admin-home-stats--focus">
        <StatCard title="Онлайн" value={overview.online_users || 0} hint="сейчас на сайте" />
        <StatCard title="Пользователи" value={overview.total_users || 0} hint="клиенты и сотрудники" />
        <StatCard title="Бронирования" value={overview.total_bookings || 0} hint="всего заявок" />
        <StatCard title="Подтверждено" value={overview.confirmed_bookings || 0} hint="готовы к поездке" />
        <StatCard title="Отменено" value={overview.cancelled_bookings || 0} hint="требуют анализа" />
        <StatCard title="Отзывы" value={overview.reviews_count || 0} hint="обратная связь" />
        <StatCard title="Рейтинг" value={Number(overview.average_rating || 0).toFixed(1)} hint="средняя оценка" />
      </section>

      <section className="admin-home-layout admin-home-layout--wide">
        <div className="admin-home-panel admin-home-panel--clean">
          <div className="admin-home-panel__head">
            <div>
              <span className="home-hero__eyebrow">Разделы админки</span>
              <h2>Что нужно сделать</h2>
            </div>
          </div>
          <div className="admin-home-actions admin-home-actions--redesigned">
            {secondaryActions.map((action) => <ActionCard key={action.title} {...action} onClick={() => navigate(action.to)} />)}
          </div>
        </div>

        <aside className="admin-home-sidepanel">
          <div className="admin-home-panel admin-home-panel--clean">
            <div className="admin-home-panel__head"><h2>Памятка сотрудника</h2></div>
            <div className="admin-focus-list">
              <FocusItem title="1. Проверяйте новые заявки" text="Сначала обработайте ожидающие бронирования и спорные статусы оплаты." />
              <FocusItem title="2. Поддерживайте каталог" text="Следите, чтобы у туров были актуальные даты, места, цена, фото и данные отеля." />
              {role === 'manager' ? (
                <FocusItem title="3. Передавайте данные аналитику" text="Если видите всплеск отмен, ошибки оплаты или неактуальные места — фиксируйте это в комментариях к заявкам." />
              ) : (
                <FocusItem title="3. Смотрите аналитику" text="Ежедневно проверяйте отмены, спрос, загрузку мест и подсказки ML-ассистента." />
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

const StatCard = ({ title, value, hint }) => (
  <div className="admin-home-stat">
    <span>{title}</span>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>
);

const ActionCard = ({ title, desc, icon, onClick }) => (
  <button type="button" className="admin-home-action" onClick={onClick}>
    <div className="admin-home-action__icon">{icon}</div>
    <div className="admin-home-action__content"><h3>{title}</h3><p>{desc}</p></div>
    <span className="admin-home-action__arrow">→</span>
  </button>
);

const FocusItem = ({ title, text }) => (
  <div className="admin-focus-item"><strong>{title}</strong><span>{text}</span></div>
);

export default AdminDashboard;
