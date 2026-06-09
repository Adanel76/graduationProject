import React, { useEffect, useMemo, useState } from 'react';
import { tourismAPI } from '../services/api';

const REPORTS = [
  { key: 'bookings', title: 'Бронирования', description: 'Заявки, статусы, оплата, сумма и клиент.', icon: '🧾', accent: 'primary', owner: 'менеджер / админ' },
  { key: 'tours', title: 'Туры', description: 'Каталог туров, даты, стоимость, места и локации.', icon: '✈️', accent: 'blue', owner: 'менеджер / админ' },
  { key: 'users', title: 'Пользователи', description: 'Клиенты и сотрудники с ролями и датами регистрации.', icon: '👥', accent: 'dark', owner: 'админ' },
  { key: 'reviews', title: 'Отзывы', description: 'Оценки клиентов, комментарии и привязка к турам.', icon: '★', accent: 'green', owner: 'менеджер / админ' },
];

const statusLabels = {
  pending: 'Ожидание',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const roleLabels = {
  client: 'Клиент',
  manager: 'Менеджер',
  analyst: 'Аналитик',
  admin: 'Администратор',
};

const initialFilters = {
  date_from: '',
  date_to: '',
  status: '',
  country: '',
  city: '',
  tour_id: '',
  role: '',
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isInsideRange = (value, dateFrom, dateTo) => {
  const date = normalizeDate(value);
  if (!date) return true;

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    if (date < from) return false;
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    if (date > to) return false;
  }

  return true;
};

const AdminReports = () => {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedDataset, setSelectedDataset] = useState('bookings');
  const [sourceData, setSourceData] = useState({ users: [], tours: [], bookings: [], reviews: [] });

  useEffect(() => {
    let mounted = true;

    const loadSummary = async () => {
      try {
        const [usersResponse, toursResponse, bookingsResponse, reviewsResponse] = await Promise.all([
          tourismAPI.getAllUsers().catch(() => ({ data: [] })),
          tourismAPI.getTours({ limit: 500, include_archived: true, include_image_data: false }).catch(() => ({ data: [] })),
          tourismAPI.getBookings().catch(() => ({ data: [] })),
          tourismAPI.getReviews().catch(() => ({ data: [] })),
        ]);

        if (!mounted) return;

        setSourceData({
          users: Array.isArray(usersResponse.data) ? usersResponse.data : [],
          tours: Array.isArray(toursResponse.data) ? toursResponse.data : [],
          bookings: Array.isArray(bookingsResponse.data) ? bookingsResponse.data : [],
          reviews: Array.isArray(reviewsResponse.data) ? reviewsResponse.data : [],
        });
      } catch (err) {
        console.error('Ошибка загрузки сводки отчётов:', err);
      }
    };

    loadSummary();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const paidBookings = sourceData.bookings.filter((booking) =>
      ['confirmed', 'completed'].includes(booking.status) || booking.payment_status === 'paid'
    );

    return {
      users: sourceData.users.length,
      tours: sourceData.tours.length,
      bookings: sourceData.bookings.length,
      reviews: sourceData.reviews.length,
      revenue: paidBookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0),
    };
  }, [sourceData]);

  const toursById = useMemo(() => {
    const map = new Map();
    sourceData.tours.forEach((tour) => map.set(Number(tour.id), tour));
    return map;
  }, [sourceData.tours]);

  const usersById = useMemo(() => {
    const map = new Map();
    sourceData.users.forEach((user) => map.set(Number(user.id), user));
    return map;
  }, [sourceData.users]);

  const countries = useMemo(() => [...new Set(sourceData.tours.map((tour) => tour.country).filter(Boolean))].sort(), [sourceData.tours]);

  const cities = useMemo(() => {
    const source = filters.country ? sourceData.tours.filter((tour) => tour.country === filters.country) : sourceData.tours;
    return [...new Set(source.map((tour) => tour.city).filter(Boolean))].sort();
  }, [filters.country, sourceData.tours]);

  const handleFilter = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'country' ? { city: '' } : {}),
    }));
  };

  const selectedReport = REPORTS.find((report) => report.key === selectedDataset) || REPORTS[0];

  const exportParams = useMemo(() => {
    const params = { ...filters };
    if (selectedDataset !== 'users') delete params.role;
    if (selectedDataset !== 'bookings') delete params.status;
    if (selectedDataset === 'users') {
      delete params.status;
      delete params.country;
      delete params.city;
      delete params.tour_id;
    }
    if (selectedDataset === 'tours') delete params.status;
    return params;
  }, [filters, selectedDataset]);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (filters.date_from) chips.push(`От ${formatDate(filters.date_from)}`);
    if (filters.date_to) chips.push(`До ${formatDate(filters.date_to)}`);
    if (filters.status) chips.push(`Статус: ${statusLabels[filters.status] || filters.status}`);
    if (filters.role) chips.push(`Роль: ${roleLabels[filters.role] || filters.role}`);
    if (filters.country) chips.push(`Страна: ${filters.country}`);
    if (filters.city) chips.push(`Город: ${filters.city}`);
    if (filters.tour_id) {
      const tour = toursById.get(Number(filters.tour_id));
      chips.push(`Тур: ${tour?.title || `#${filters.tour_id}`}`);
    }
    return chips;
  }, [filters, toursById]);

  const matchesTourFilters = (tour) => {
    if (filters.country && tour?.country !== filters.country) return false;
    if (filters.city && tour?.city !== filters.city) return false;
    if (filters.tour_id && String(tour?.id) !== String(filters.tour_id)) return false;
    return true;
  };

  const previewRows = useMemo(() => {
    if (selectedDataset === 'users') {
      return sourceData.users
        .filter((user) => !filters.role || user.role === filters.role)
        .filter((user) => isInsideRange(user.created_at, filters.date_from, filters.date_to))
        .map((user) => ({
          ID: user.id,
          Email: user.email,
          Имя: [user.first_name, user.last_name].filter(Boolean).join(' ') || '—',
          Роль: roleLabels[user.role] || user.role,
          Подтверждён: user.is_verified ? 'Да' : 'Нет',
          Регистрация: formatDate(user.created_at),
        }));
    }

    if (selectedDataset === 'tours') {
      return sourceData.tours
        .filter(matchesTourFilters)
        .filter((tour) => isInsideRange(tour.start_date, filters.date_from, filters.date_to))
        .map((tour) => ({
          ID: tour.id,
          Тур: tour.title,
          Направление: [tour.city, tour.country].filter(Boolean).join(', ') || '—',
          Цена: formatMoney(tour.price),
          Даты: `${formatDate(tour.start_date)} — ${formatDate(tour.end_date)}`,
          Места: tour.max_people || '—',
        }));
    }

    if (selectedDataset === 'reviews') {
      return sourceData.reviews
        .filter((review) => {
          const tour = toursById.get(Number(review.tour_id));
          return matchesTourFilters(tour);
        })
        .filter((review) => isInsideRange(review.created_at, filters.date_from, filters.date_to))
        .map((review) => {
          const tour = toursById.get(Number(review.tour_id));
          const user = usersById.get(Number(review.user_id));
          return {
            ID: review.id,
            Клиент: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || `#${review.user_id}`,
            Тур: tour?.title || `#${review.tour_id}`,
            Рейтинг: review.rating,
            Комментарий: review.comment || '—',
            Дата: formatDate(review.created_at),
          };
        });
    }

    return sourceData.bookings
      .filter((booking) => !filters.status || booking.status === filters.status)
      .filter((booking) => isInsideRange(booking.booking_date || booking.created_at, filters.date_from, filters.date_to))
      .filter((booking) => {
        const tour = toursById.get(Number(booking.tour_id));
        return matchesTourFilters(tour);
      })
      .map((booking) => {
        const tour = toursById.get(Number(booking.tour_id));
        const user = usersById.get(Number(booking.user_id));
        return {
          ID: booking.id,
          Клиент: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || `#${booking.user_id}`,
          Тур: tour?.title || `#${booking.tour_id}`,
          Статус: statusLabels[booking.status] || booking.status,
          Оплата: booking.payment_status || '—',
          Сумма: formatMoney(booking.total_price),
          Дата: formatDate(booking.booking_date || booking.created_at),
        };
      });
  }, [selectedDataset, sourceData, filters, toursById, usersById]);

  const previewColumns = useMemo(() => Object.keys(previewRows[0] || {}), [previewRows]);
  const visibleRows = previewRows.slice(0, 8);

  const reportStats = useMemo(() => {
    const revenue = selectedDataset === 'bookings'
      ? sourceData.bookings
          .filter((booking) => previewRows.some((row) => Number(row.ID) === Number(booking.id)))
          .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
      : 0;

    return {
      rows: previewRows.length,
      columns: previewColumns.length,
      activeFilters: activeFilters.length,
      revenue,
    };
  }, [activeFilters.length, previewColumns.length, previewRows, selectedDataset, sourceData.bookings]);

  const handleExport = async (dataset, format) => {
    const key = `${dataset}_${format}`;
    setLoading((prev) => ({ ...prev, [key]: true }));
    setError('');

    try {
      await tourismAPI.exportReport(dataset, format, exportParams);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      setError(err?.response?.data?.detail || 'Не удалось выгрузить отчёт');
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const resetFilters = () => setFilters(initialFilters);

  return (
    <div className="page-shell admin-reports-page admin-reports-page--pro">
      <section className="admin-reports-hero">
        <div>
          <span className="home-hero__eyebrow">Reports / Export center</span>
          <h1>Центр отчётов</h1>
          <p>
            Рабочая зона для подготовки выгрузок: сначала выберите набор данных, затем примените фильтры,
            проверьте предпросмотр и скачайте CSV/XLSX для руководителя, менеджера или дипломной аналитики.
          </p>
        </div>
        <div className="admin-reports-hero__card">
          <span>Выбранный отчёт</span>
          <strong>{selectedReport.title}</strong>
          <small>{selectedReport.description}</small>
        </div>
      </section>

      <section className="admin-reports-kpi-grid">
        <ReportKpi title="Пользователи" value={summary.users} hint="клиенты и сотрудники" />
        <ReportKpi title="Туры" value={summary.tours} hint="активные и архивные" />
        <ReportKpi title="Бронирования" value={summary.bookings} hint="все заявки" />
        <ReportKpi title="Выручка" value={formatMoney(summary.revenue)} hint="оплаченные/подтверждённые" />
      </section>

      <section className="admin-reports-workspace admin-reports-workspace--pro">
        <aside className="admin-reports-dataset-panel">
          <span className="home-hero__eyebrow">Набор данных</span>
          <h2>Что выгружаем</h2>
          <div className="admin-reports-dataset-list">
            {REPORTS.map((report) => (
              <button
                key={report.key}
                type="button"
                className={`admin-reports-dataset ${selectedDataset === report.key ? 'admin-reports-dataset--active' : ''}`}
                onClick={() => setSelectedDataset(report.key)}
              >
                <span>{report.icon}</span>
                <div>
                  <strong>{report.title}</strong>
                  <small>{report.description}</small>
                  <em>{report.owner}</em>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="admin-reports-filter-panel">
          <div className="admin-reports-filter-panel__head">
            <div>
              <span className="home-hero__eyebrow">Фильтры отчёта</span>
              <h2>{selectedReport.title}</h2>
            </div>
            <button type="button" className="site-button site-button--secondary" onClick={resetFilters}>
              Сбросить
            </button>
          </div>

          <div className="admin-reports-filters-grid">
            <ReportField label="Дата от">
              <input type="date" value={filters.date_from} onChange={(event) => handleFilter('date_from', event.target.value)} />
            </ReportField>
            <ReportField label="Дата до">
              <input type="date" value={filters.date_to} onChange={(event) => handleFilter('date_to', event.target.value)} />
            </ReportField>

            {selectedDataset === 'bookings' && (
              <ReportField label="Статус заявки">
                <select value={filters.status} onChange={(event) => handleFilter('status', event.target.value)}>
                  <option value="">Все статусы</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </ReportField>
            )}

            {selectedDataset === 'users' && (
              <ReportField label="Роль пользователя">
                <select value={filters.role} onChange={(event) => handleFilter('role', event.target.value)}>
                  <option value="">Все роли</option>
                  {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </ReportField>
            )}

            {selectedDataset !== 'users' && (
              <>
                <ReportField label="Страна">
                  <select value={filters.country} onChange={(event) => handleFilter('country', event.target.value)}>
                    <option value="">Все страны</option>
                    {countries.map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                </ReportField>
                <ReportField label="Город">
                  <select value={filters.city} onChange={(event) => handleFilter('city', event.target.value)}>
                    <option value="">Все города</option>
                    {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </ReportField>
                <ReportField label="Тур">
                  <select value={filters.tour_id} onChange={(event) => handleFilter('tour_id', event.target.value)}>
                    <option value="">Все туры</option>
                    {sourceData.tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.title}</option>)}
                  </select>
                </ReportField>
              </>
            )}
          </div>

          <div className="admin-reports-active-filters">
            {activeFilters.length === 0 ? (
              <span>Фильтры не применены — в выгрузку попадёт весь выбранный набор данных.</span>
            ) : activeFilters.map((chip) => <strong key={chip}>{chip}</strong>)}
          </div>

          {error ? <div className="detail-alert detail-alert--error">{error}</div> : null}

          <div className="admin-reports-export-box">
            <div>
              <strong>Экспорт выбранного отчёта</strong>
              <span>Backend применит фильтры и сформирует итоговый файл. Предпросмотр ниже помогает проверить состав отчёта до скачивания.</span>
            </div>
            <div className="admin-reports-export-actions">
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => handleExport(selectedDataset, 'csv')}
                disabled={loading[`${selectedDataset}_csv`]}
              >
                {loading[`${selectedDataset}_csv`] ? 'Готовлю CSV...' : 'Скачать CSV'}
              </button>
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={() => handleExport(selectedDataset, 'excel')}
                disabled={loading[`${selectedDataset}_excel`]}
              >
                {loading[`${selectedDataset}_excel`] ? 'Готовлю XLSX...' : 'Скачать XLSX'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-reports-preview-grid">
        <div className="admin-reports-preview-card admin-reports-preview-card--dark">
          <span className="home-hero__eyebrow">Report preview</span>
          <h2>Проверка перед экспортом</h2>
          <div className="admin-reports-preview-stats">
            <ReportKpi title="Строк" value={reportStats.rows} hint="после фильтров" />
            <ReportKpi title="Колонок" value={reportStats.columns} hint="в предпросмотре" />
            <ReportKpi title="Фильтров" value={reportStats.activeFilters} hint="активно" />
            <ReportKpi title="Сумма" value={selectedDataset === 'bookings' ? formatMoney(reportStats.revenue) : '—'} hint="для бронирований" />
          </div>
        </div>

        <div className="admin-reports-preview-card">
          <div className="admin-reports-filter-panel__head">
            <div>
              <span className="home-hero__eyebrow">First rows</span>
              <h2>Первые строки</h2>
            </div>
            <small>Показано до 8 строк</small>
          </div>
          {visibleRows.length === 0 ? (
            <div className="home-empty">Нет данных по выбранным фильтрам</div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-data-table admin-data-table--compact">
                <thead>
                  <tr>{previewColumns.slice(0, 7).map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr key={`preview-${index}`}>
                      {previewColumns.slice(0, 7).map((column) => <td key={column}>{String(row[column] ?? '').slice(0, 90)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="admin-reports-guide">
        <div>
          <strong>Когда использовать отчёты</strong>
          <span>Для регулярных выгрузок, передачи таблиц руководителю, проверки заявок и подготовки приложений к диплому.</span>
        </div>
        <div>
          <strong>Когда использовать CSV-центр</strong>
          <span>Для загрузки внешних датасетов, проверки структуры, предпросмотра и последующего анализа.</span>
        </div>
        <div>
          <strong>Рекомендация</strong>
          <span>Перед экспортом всегда проверяйте количество строк и активные фильтры, чтобы не скачать лишние данные.</span>
        </div>
      </section>
    </div>
  );
};

const ReportKpi = ({ title, value, hint }) => (
  <div className="admin-reports-kpi">
    <span>{title}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </div>
);

const ReportField = ({ label, children }) => (
  <label className="admin-reports-field">
    <span>{label}</span>
    {children}
  </label>
);

export default AdminReports;
