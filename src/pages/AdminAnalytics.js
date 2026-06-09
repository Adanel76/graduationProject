import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#111111', '#4b5563', '#9ca3af', '#d1d5db', '#6b7280'];

const defaultFilters = {
  date_from: '',
  date_to: '',
  status: '',
  tour_id: '',
  country: '',
  city: '',
};

const AdminAnalytics = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tours, setTours] = useState([]);

  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const [loading, setLoading] = useState(true);
  const [mlTraining, setMlTraining] = useState(false);
  const [error, setError] = useState('');

  const buildParams = (source) => {
    const params = {};
    Object.entries(source).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        if (key === 'date_from') {
          params.start_date = value;
        } else if (key === 'date_to') {
          params.end_date = value;
        } else {
          params[key] = value;
        }
      }
    });
    return params;
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const meResponse = await tourismAPI.getCurrentUser();
      const me = meResponse.data;

      if (!['admin', 'analyst'].includes(me.role)) {
        navigate('/profile');
        return;
      }

      setCurrentUser(me);
      await tourismAPI.sendHeartbeat().catch(() => null);

      const [toursResponse, dashboardResponse] = await Promise.all([
        tourismAPI.getTours({ include_archived: true, limit: 500 }),
        tourismAPI.getAnalyticsDashboard(buildParams(appliedFilters)),
      ]);

      setTours(toursResponse.data || []);
      setDashboard(dashboardResponse.data);
    } catch (err) {
      console.error('Ошибка загрузки аналитики:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (err.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setError(err.response?.data?.detail || 'Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, navigate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!currentUser?.id || !['admin', 'analyst'].includes(currentUser?.role)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        await tourismAPI.sendHeartbeat();
        const response = await tourismAPI.getAnalyticsDashboard(buildParams(appliedFilters));
        setDashboard(response.data);
      } catch (err) {
        console.error('Ошибка фонового обновления аналитики:', err);
      }
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [appliedFilters, currentUser?.id, currentUser?.role]);

  const countries = useMemo(() => {
    return [...new Set((tours || []).map((tour) => tour.country).filter(Boolean))].sort();
  }, [tours]);

  const cities = useMemo(() => {
    const relevantTours = filters.country
      ? tours.filter((tour) => tour.country === filters.country)
      : tours;

    return [...new Set(relevantTours.map((tour) => tour.city).filter(Boolean))].sort();
  }, [tours, filters.country]);

  const overview = dashboard?.overview || {
    total_users: 0,
    online_users: 0,
    total_tours: 0,
    total_bookings: 0,
    confirmed_bookings: 0,
    pending_bookings: 0,
    cancelled_bookings: 0,
    total_revenue: 0,
    average_rating: 0,
  };

  const bookingStatuses = useMemo(() => {
    return (dashboard?.booking_statuses || []).map((item) => ({
      ...item,
      label:
        item.status === 'pending'
          ? 'Ожидание'
          : item.status === 'confirmed'
          ? 'Подтверждено'
          : item.status === 'completed'
          ? 'Завершено'
          : item.status === 'cancelled'
          ? 'Отменено'
          : item.status,
    }));
  }, [dashboard]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (appliedFilters.date_from) {
      chips.push(`От: ${new Date(appliedFilters.date_from).toLocaleDateString('ru-RU')}`);
    }

    if (appliedFilters.date_to) {
      chips.push(`До: ${new Date(appliedFilters.date_to).toLocaleDateString('ru-RU')}`);
    }

    if (appliedFilters.status) {
      const label =
        appliedFilters.status === 'pending'
          ? 'Ожидание'
          : appliedFilters.status === 'confirmed'
          ? 'Подтверждено'
          : appliedFilters.status === 'completed'
          ? 'Завершено'
          : appliedFilters.status === 'cancelled'
          ? 'Отменено'
          : appliedFilters.status;
      chips.push(`Статус: ${label}`);
    }

    if (appliedFilters.tour_id) {
      const selectedTour = tours.find((tour) => String(tour.id) === String(appliedFilters.tour_id));
      chips.push(`Тур: ${selectedTour?.title || `#${appliedFilters.tour_id}`}`);
    }

    if (appliedFilters.country) {
      chips.push(`Страна: ${appliedFilters.country}`);
    }

    if (appliedFilters.city) {
      chips.push(`Город: ${appliedFilters.city}`);
    }

    return chips;
  }, [appliedFilters, tours]);

  const usersByDay = dashboard?.users_by_day || [];
  const bookingsByDay = dashboard?.bookings_by_day || [];
  const revenueByDay = dashboard?.revenue_by_day || [];
  const bookingsByCountry = dashboard?.bookings_by_country || [];
  const bookingsByCity = dashboard?.bookings_by_city || [];
  const capacityByTour = dashboard?.capacity_by_tour || [];
  const topTours = dashboard?.top_tours || [];
  const paymentStatuses = dashboard?.payment_statuses || [];
  const paymentMethods = dashboard?.payment_methods || [];
  const weekdayDemand = dashboard?.weekday_demand || [];
  const priceSegments = dashboard?.price_segments || [];
  const durationSegments = dashboard?.duration_segments || [];
  const conversionFunnel = dashboard?.conversion_funnel || [];
  const analystInsights = dashboard?.analyst_insights || [];
  const dataQuality = dashboard?.data_quality || [];
  const periodComparison = dashboard?.period_comparison || null;
  const mlAssistant = dashboard?.ml_assistant || null;

  const mlForecast = mlAssistant?.forecast_next_7_days || [];
  const totalForecastBookings = mlForecast.reduce((sum, item) => sum + Number(item.bookings || 0), 0);
  const totalForecastRevenue = mlForecast.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const alertSignals = (mlAssistant?.signals || []).filter((item) => ['danger', 'warning'].includes(item.tone));
  const topMlSignals = (mlAssistant?.signals || []).slice(0, 4);
  const mlAccuracyMetrics = mlAssistant?.accuracy_metrics || [];
  const mlFeatureImportance = mlAssistant?.feature_importance || [];
  const mlAlgorithmNotes = mlAssistant?.algorithm_notes || [];
  const mlModelFiles = mlAssistant?.local_model_files || [];
  const qualityProblems = dataQuality.filter((item) => item.value > 0);
  const strongestWeekday = weekdayDemand.reduce((best, item) => (Number(item.value || 0) > Number(best.value || 0) ? item : best), { name: '—', value: 0 });
  const latestRevenue = revenueByDay.slice(-7).reduce((sum, item) => sum + Number(item.value || 0), 0);
  const latestBookings = bookingsByDay.slice(-7).reduce((sum, item) => sum + Number(item.value || 0), 0);
  const cancellationRate = overview.total_bookings ? (Number(overview.cancelled_bookings || 0) / Number(overview.total_bookings || 1)) * 100 : 0;
  const confirmationRate = overview.total_bookings ? ((Number(overview.confirmed_bookings || 0) + Number(overview.completed_bookings || 0)) / Number(overview.total_bookings || 1)) * 100 : 0;

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
  const formatDelta = (value) => `${Number(value || 0) > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const handleTrainMlAssistant = async () => {
    try {
      setMlTraining(true);
      const response = await tourismAPI.trainMlAssistant(buildParams(appliedFilters));
      setDashboard((prev) => ({ ...(prev || {}), ml_assistant: response.data }));
    } catch (err) {
      console.error('Ошибка переобучения ML-ассистента:', err);
      setError(err?.response?.data?.detail || 'Не удалось переобучить ML-ассистента');
    } finally {
      setMlTraining(false);
    }
  };

  const handleChange = (field, value) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'country') {
        next.city = '';
      }

      return next;
    });
  };

  if (loading) {
    return (
      <div className="page-shell admin-analytics-page">
        <div className="home-empty">Загрузка аналитики...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell admin-analytics-page">
        <div className="home-empty" style={{ color: '#dc2626' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell admin-analytics-page">
      <section className="admin-analytics-hero">
        <div>
          <span className="home-hero__eyebrow">BI / Dashboard</span>
          <h1 className="admin-analytics-hero__title">Аналитика системы</h1>
          <p className="admin-analytics-hero__text">
            Анализ бронирований, статусов, выручки и направлений с гибкими фильтрами.
          </p>
        </div>

        <div className="admin-analytics-hero__side">
          <div className="admin-analytics-chip">
            <span>Сессия</span>
            <strong>{currentUser?.first_name || 'Admin'}</strong>
          </div>

          <div className="admin-analytics-chip">
            <span>Средний рейтинг</span>
            <strong>{Number(overview.average_rating || 0).toFixed(1)}</strong>
          </div>
        </div>
      </section>

      <section className="admin-analytics-filters">
        <div className="admin-analytics-filters__grid">
          <div className="admin-analytics-field">
            <label>Дата от</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleChange('date_from', e.target.value)}
            />
          </div>

          <div className="admin-analytics-field">
            <label>Дата до</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleChange('date_to', e.target.value)}
            />
          </div>

          <div className="admin-analytics-field">
            <label>Статус</label>
            <select
              value={filters.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="">Все</option>
              <option value="pending">Ожидание</option>
              <option value="confirmed">Подтверждено</option>
              <option value="completed">Завершено</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>

          <div className="admin-analytics-field">
            <label>Тур</label>
            <select
              value={filters.tour_id}
              onChange={(e) => handleChange('tour_id', e.target.value)}
            >
              <option value="">Все туры</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.title}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-analytics-field">
            <label>Страна</label>
            <select
              value={filters.country}
              onChange={(e) => handleChange('country', e.target.value)}
            >
              <option value="">Все страны</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-analytics-field">
            <label>Город</label>
            <select
              value={filters.city}
              onChange={(e) => handleChange('city', e.target.value)}
            >
              <option value="">Все города</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-analytics-filters__actions">
          <button
            type="button"
            className="site-button site-button--primary"
            onClick={applyFilters}
          >
            Применить
          </button>

          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={resetFilters}
          >
            Сбросить
          </button>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="admin-analytics-filters__chips">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="admin-analytics-filter-chip">
                {chip}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="admin-analytics-workbench admin-analytics-workbench--bi">
        <div className="analytics-workbench-card analytics-workbench-card--bot analytics-workbench-card--summary">
          <div className="analytics-workbench-card__head">
            <div>
              <span className="analytics-workbench-card__eyebrow">MetricBot monitor</span>
              <h2>Краткая сводка модели</h2>
            </div>
            <div className={`analytics-risk-pill analytics-risk-pill--${mlAssistant?.risk_level || 'unknown'}`}>
              {mlAssistant?.risk_level === 'high' ? 'Высокий риск' : mlAssistant?.risk_level === 'medium' ? 'Средний риск' : 'Низкий риск'}
            </div>
          </div>

          <div className="analytics-workbench-summary-layout">
            <div className="analytics-workbench-summary-text">
              <p>{mlAssistant?.summary || 'Модель ожидает накопления истории: добавьте заявки или загрузите CSV с продажами.'}</p>
              <div className="analytics-workbench-signals">
                {(topMlSignals.length ? topMlSignals : [{ title: 'Нет сигналов', value: '—', text: 'После загрузки данных MetricBot покажет ключевые отклонения.', tone: 'info' }]).map((signal) => (
                  <CompactSignal key={signal.title} signal={signal} />
                ))}
              </div>
            </div>

            <div className="analytics-workbench-bot-grid">
              <WorkbenchMetric label="Прогноз заявок" value={Number(totalForecastBookings || 0).toFixed(1)} hint="на 7 дней" />
              <WorkbenchMetric label="Прогноз выручки" value={formatMoney(totalForecastRevenue)} hint="на 7 дней" />
              <WorkbenchMetric label="Уверенность" value={`${Number(mlAssistant?.confidence || 0).toFixed(1)}%`} hint={mlAssistant?.model_name || 'MetricBot'} />
              <WorkbenchMetric label="Пик спроса" value={strongestWeekday.name || '—'} hint={`${strongestWeekday.value || 0} заявок`} />
            </div>
          </div>
        </div>

        <aside className="analytics-workbench-card analytics-workbench-card--dark analytics-workbench-card--live">
          <span className="analytics-workbench-card__eyebrow">Live control</span>
          <h2>Оперативная картина</h2>
          <div className="analytics-workbench-metrics">
            <WorkbenchMetric label="Онлайн" value={overview.online_users || 0} hint="активны за 90 сек." />
            <WorkbenchMetric label="Заявки за 7 дней" value={latestBookings} hint="последняя неделя" />
            <WorkbenchMetric label="Выручка за 7 дней" value={formatMoney(latestRevenue)} hint="подтверждённая динамика" />
            <WorkbenchMetric label="Загрузка мест" value={`${Number(overview.occupancy_rate || 0).toFixed(1)}%`} hint="по активным турам" />
          </div>
        </aside>

        <aside className="analytics-workbench-card analytics-workbench-card--light analytics-workbench-card--quality">
          <span className="analytics-workbench-card__eyebrow">Quality gate</span>
          <h2>Контроль данных</h2>
          <div className="analytics-workbench-quality">
            <WorkbenchMetric label="Проблемы данных" value={qualityProblems.length} hint="нужно проверить" />
            <WorkbenchMetric label="Доля отмен" value={`${cancellationRate.toFixed(1)}%`} hint="по выбранному периоду" />
            <WorkbenchMetric label="Подтверждение" value={`${confirmationRate.toFixed(1)}%`} hint="конверсия заявок" />
          </div>
          <div className="analytics-workbench-todo">
            {(alertSignals.length ? alertSignals : qualityProblems).slice(0, 3).map((item) => (
              <div key={item.title || item.name}>
                <strong>{item.title || item.name}</strong>
                <span>{item.text || item.description}</span>
              </div>
            ))}
            {alertSignals.length === 0 && qualityProblems.length === 0 && (
              <div>
                <strong>Критичных проблем нет</strong>
                <span>Карточки туров и метрики выглядят корректно.</span>
              </div>
            )}
          </div>
        </aside>
      </section>

      {mlAssistant && (
        <section className={`admin-ml-bot admin-ml-bot--${mlAssistant.risk_level || 'low'}`}>
          <div className="admin-ml-bot__main">
            <span className="home-hero__eyebrow">Машинное обучение</span>
            <h2>MetricBot — бот аналитика</h2>
            <p>{mlAssistant.summary}</p>

            <div className="admin-ml-bot__meta">
              <span>Модель: <strong>{mlAssistant.model_name}</strong></span>
              <span>Выборка: <strong>{mlAssistant.training_samples}</strong></span>
              <span>Уверенность: <strong>{Number(mlAssistant.confidence || 0).toFixed(1)}%</strong></span>
              <span>Риск: <strong>{mlAssistant.risk_level}</strong></span>
              <span>Версия: <strong>{mlAssistant.model_version || 'local'}</strong></span>
              {mlAssistant.training_window_start && mlAssistant.training_window_end && (
                <span>Окно: <strong>{new Date(mlAssistant.training_window_start).toLocaleDateString('ru-RU')} - {new Date(mlAssistant.training_window_end).toLocaleDateString('ru-RU')}</strong></span>
              )}
            </div>

            {['admin', 'analyst'].includes(currentUser?.role) && (
              <button type="button" className="site-button site-button--secondary admin-ml-bot__train" onClick={handleTrainMlAssistant} disabled={mlTraining}>
                {mlTraining ? 'Обучение...' : 'Переобучить модель'}
              </button>
            )}
          </div>

          <div className="admin-ml-bot__side">
            <h3>Сигналы модели</h3>
            <div className="admin-ml-bot__signals">
              {(mlAssistant.signals || []).map((signal) => (
                <div key={signal.title} className={`admin-ml-signal admin-ml-signal--${signal.tone}`}>
                  <span>{signal.title}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.text}</small>
                </div>
              ))}
            </div>
          </div>

          {(mlAccuracyMetrics.length > 0 || mlFeatureImportance.length > 0 || mlAlgorithmNotes.length > 0) && (
            <div className="admin-ml-bot__explain">
              {mlAccuracyMetrics.length > 0 && (
                <div className="admin-ml-bot__panel">
                  <h3>Качество обучения</h3>
                  <div className="admin-ml-bot__metrics">
                    {mlAccuracyMetrics.map((metric) => (
                      <div key={metric.name} className="admin-ml-chip">
                        <span>{metric.name}</span>
                        <strong>{Number(metric.value || 0).toLocaleString('ru-RU')} {metric.unit}</strong>
                        <small>{metric.description}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mlFeatureImportance.length > 0 && (
                <div className="admin-ml-bot__panel">
                  <h3>Что влияет на прогноз</h3>
                  <div className="admin-ml-bot__features">
                    {mlFeatureImportance.map((item) => (
                      <div key={item.feature} className="admin-ml-feature">
                        <div>
                          <strong>{item.feature}</strong>
                          <span>{item.description}</span>
                        </div>
                        <em>{Number(item.importance || 0).toFixed(1)}%</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mlAlgorithmNotes.length > 0 && (
                <div className="admin-ml-bot__panel admin-ml-bot__panel--notes">
                  <h3>Локальный ML</h3>
                  <div className="admin-ml-notes">
                    {mlAlgorithmNotes.slice(0, 5).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                    {mlModelFiles.length > 0 && (
                      <small>Файлы модели: {mlModelFiles.map((path) => path.split(/[\\/]/).pop()).join(', ')}</small>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="admin-ml-bot__forecast">
            <h3>Прогноз на 7 дней</h3>
            <div className="admin-ml-forecast">
              {(mlAssistant.forecast_next_7_days || []).map((point) => (
                <div key={point.date} className="admin-ml-forecast__item">
                  <span>{new Date(point.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                  <strong>{Number(point.bookings || 0).toFixed(1)}</strong>
                  <small>{formatMoney(point.revenue || 0)}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-ml-bot__recommendations">
            <h3>Что сделать</h3>
            {(mlAssistant.recommendations || []).map((item) => (
              <div key={item} className="admin-ml-recommendation">{item}</div>
            ))}
          </div>
        </section>
      )}

      <section className="admin-analytics-stats">
        <StatCard title="Онлайн" value={overview.online_users || 0} />
        <StatCard title="Пользователи" value={overview.total_users || 0} />
        <StatCard title="Туры" value={overview.total_tours || 0} />
        <StatCard title="Активные туры" value={overview.active_tours || 0} />
        <StatCard title="Архив" value={overview.archived_tours || 0} />
        <StatCard title="Бронирования" value={overview.total_bookings || 0} />
        <StatCard title="Подтверждено" value={overview.confirmed_bookings || 0} />
        <StatCard title="Ожидают" value={overview.pending_bookings || 0} />
        <StatCard title="Отменено" value={overview.cancelled_bookings || 0} />
        <StatCard title="Завершено" value={overview.completed_bookings || 0} />
        <StatCard title="Выручка" value={formatMoney(overview.total_revenue || 0)} />
        <StatCard title="Средний чек" value={formatMoney(overview.average_check || 0)} />
        <StatCard title="Свободные места" value={overview.available_seats || 0} />
        <StatCard title="Загрузка мест" value={`${Number(overview.occupancy_rate || 0).toFixed(1)}%`} />
        <StatCard
          title="Средний рейтинг"
          value={Number(overview.average_rating || 0).toFixed(1)}
        />
      </section>

      <section className="admin-analytics-deep-grid">
        <div className="admin-analytics-panel admin-analytics-panel--midnight">
          <div className="admin-analytics-panel__head">
            <div>
              <span className="home-hero__eyebrow">Analyst cockpit</span>
              <h2>Ключевые выводы</h2>
            </div>
          </div>
          <div className="admin-analytics-insights">
            {analystInsights.map((item) => (
              <div key={item.title} className={`admin-analytics-insight admin-analytics-insight--${item.tone}`}>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Сравнение с прошлым периодом</h2>
          </div>
          {periodComparison ? (
            <div className="admin-analytics-comparison">
              <small>Предыдущий период: {periodComparison.previous_start_date} — {periodComparison.previous_end_date}</small>
              <div><span>Заявки</span><strong>{formatDelta(periodComparison.bookings_delta_percent)}</strong></div>
              <div><span>Выручка</span><strong>{formatDelta(periodComparison.revenue_delta_percent)}</strong></div>
              <div><span>Отмены</span><strong>{formatDelta(periodComparison.cancelled_delta_percent)}</strong></div>
              <div><span>Средний чек</span><strong>{formatDelta(periodComparison.average_check_delta_percent)}</strong></div>
            </div>
          ) : (
            <div className="home-empty">Нет данных</div>
          )}
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Воронка заявок</h2>
          </div>
          {conversionFunnel.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-funnel">
              {conversionFunnel.map((step, index) => (
                <div key={step.name} className="admin-analytics-funnel-step">
                  <div>
                    <span>{index + 1}. {step.name}</span>
                    <strong>{step.value}</strong>
                  </div>
                  <div className="admin-analytics-progress"><i style={{ width: `${Math.min(Number(step.rate || 0), 100)}%` }} /></div>
                  <small>{Number(step.rate || 0).toFixed(1)}%</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Качество данных</h2>
          </div>
          <div className="admin-analytics-data-quality">
            {dataQuality.map((item) => (
              <div key={item.name} className={`admin-analytics-quality admin-analytics-quality--${item.severity}`}>
                <div><span>{item.name}</span><p>{item.description}</p></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Спрос по дням недели</h2>
          </div>
          {weekdayDemand.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={390}>
              <BarChart data={weekdayDemand}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Заявки" fill="#111827" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Ценовые сегменты</h2>
          </div>
          {priceSegments.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-mini-list">
              {priceSegments.map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <div>
                    <div className="admin-analytics-mini-item__title">{item.name}</div>
                    <div className="admin-analytics-mini-item__meta">{item.value} заявок · {Number(item.rate || 0).toFixed(1)}%</div>
                  </div>
                  <strong>{formatMoney(item.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Статусы оплат</h2>
          </div>
          {paymentStatuses.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-mini-list">
              {paymentStatuses.map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <span>{item.name}</span>
                  <strong>{item.value} · {formatMoney(item.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Методы оплат и длительность</h2>
          </div>
          <div className="admin-analytics-split-list">
            <div>
              <h3>Методы</h3>
              {(paymentMethods.length ? paymentMethods : [{ name: 'Нет данных', value: 0, revenue: 0 }]).map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <span>{item.name}</span><strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div>
              <h3>Длительность</h3>
              {(durationSegments.length ? durationSegments : [{ name: 'Нет данных', value: 0, revenue: 0 }]).map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <span>{item.name}</span><strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Регистрации пользователей</h2>
          </div>

          {usersByDay.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={usersByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Пользователи"
                  stroke="#111111"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Бронирования по дням</h2>
          </div>

          {bookingsByDay.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={bookingsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Бронирования" fill="#111111" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Выручка по дням</h2>
          </div>

          {revenueByDay.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Выручка"
                  stroke="#111111"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Загрузка туров по местам</h2>
          </div>

          {capacityByTour.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-mini-list admin-analytics-mini-list--capacity">
              {capacityByTour.map((tour) => (
                <div key={tour.tour_id} className="admin-analytics-capacity-item">
                  <div>
                    <div className="admin-analytics-mini-item__title">{tour.title}</div>
                    <div className="admin-analytics-mini-item__meta">
                      Занято {tour.reserved_seats} из {tour.max_people} · свободно {tour.available_seats}
                    </div>
                  </div>
                  <strong>{Number(tour.occupancy_rate || 0).toFixed(1)}%</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Статусы бронирований</h2>
          </div>

          {bookingStatuses.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={420}>
                <PieChart>
                  <Pie
                    data={bookingStatuses}
                    dataKey="count"
                    nameKey="label"
                    outerRadius={110}
                    label
                  >
                    {bookingStatuses.map((entry, index) => (
                      <Cell
                        key={`${entry.status}-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              <div className="admin-analytics-mini-list">
                {bookingStatuses.map((item) => (
                  <div key={item.status} className="admin-analytics-mini-item">
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Топ туров</h2>
          </div>

          {topTours.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={topTours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" hide />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="bookings_count"
                    name="Бронирования"
                    fill="#111111"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div className="admin-analytics-mini-list">
                {topTours.map((tour) => (
                  <div key={tour.tour_id} className="admin-analytics-mini-item">
                    <div>
                      <div className="admin-analytics-mini-item__title">{tour.title}</div>
                      <div className="admin-analytics-mini-item__meta">
                        Бронирований: {tour.bookings_count}
                      </div>
                    </div>
                    <strong>{formatMoney(tour.revenue)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Бронирования по странам</h2>
          </div>

          {bookingsByCountry.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-mini-list">
              {bookingsByCountry.map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <span>{item.name}</span>
                  <strong>{item.value} · {formatMoney(item.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-analytics-panel">
          <div className="admin-analytics-panel__head">
            <h2>Бронирования по городам</h2>
          </div>

          {bookingsByCity.length === 0 ? (
            <div className="home-empty">Нет данных</div>
          ) : (
            <div className="admin-analytics-mini-list">
              {bookingsByCity.map((item) => (
                <div key={item.name} className="admin-analytics-mini-item">
                  <span>{item.name}</span>
                  <strong>{item.value} · {formatMoney(item.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ title, value }) => (
  <div className="admin-analytics-stat">
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
);

const WorkbenchMetric = ({ label, value, hint }) => (
  <div className="analytics-workbench-metric">
    <span>{label}</span>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>
);

const CompactSignal = ({ signal }) => (
  <div className={`analytics-compact-signal analytics-compact-signal--${signal.tone || 'info'}`}>
    <span>{signal.title}</span>
    <strong>{signal.value}</strong>
    <small>{signal.text}</small>
  </div>
);

export default AdminAnalytics;
