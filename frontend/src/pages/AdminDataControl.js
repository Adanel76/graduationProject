import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useToast } from '../components/ToastContext';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
};

const getQualityScore = (dataset) => {
  const issues = (dataset?.issues || []).length;
  if (!dataset) return 0;
  if (!dataset.rows_count || !dataset.columns_count) return 45;
  return Math.max(40, 100 - issues * 18);
};

const datasetTypeLabels = {
  analytics: 'Аналитика',
  bookings: 'Бронирования',
  clients: 'Клиенты',
  marketing: 'Маркетинг',
  dataset: 'Датасет',
  other: 'Другое',
};

const AdminDataControl = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [datasetType, setDatasetType] = useState('analytics');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [meResponse, datasetsResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getCsvDatasets(),
      ]);

      const me = meResponse?.data;
      if (!['admin', 'analyst'].includes(me?.role)) {
        navigate('/admin');
        return;
      }

      const loaded = Array.isArray(datasetsResponse?.data) ? datasetsResponse.data : [];
      setCurrentUser(me);
      setDatasets(loaded);

      if (!selectedDataset && loaded.length > 0) {
        setSelectedDataset(loaded[0]);
      }
    } catch (err) {
      console.error('Ошибка загрузки CSV-раздела:', err);
      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }
      if (err?.response?.status === 403) {
        navigate('/admin');
        return;
      }
      setError(err?.response?.data?.detail || 'Не удалось загрузить CSV-наборы');
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedDataset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const rows = datasets.reduce((sum, item) => sum + Number(item.rows_count || 0), 0);
    const size = datasets.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
    const withIssues = datasets.filter((item) => (item.issues || []).length > 0).length;
    const ready = datasets.filter((item) => (item.issues || []).length === 0 && Number(item.rows_count || 0) > 0).length;
    return { files: datasets.length, rows, size, withIssues, ready };
  }, [datasets]);

  const datasetTypes = useMemo(() => {
    return [...new Set(datasets.map((item) => item.dataset_type).filter(Boolean))].sort();
  }, [datasets]);

  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return datasets.filter((dataset) => {
      const text = [dataset.original_filename, dataset.dataset_type, dataset.uploaded_by_name, ...(dataset.columns || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = query ? text.includes(query) : true;
      const matchesType = typeFilter ? dataset.dataset_type === typeFilter : true;
      const hasIssues = (dataset.issues || []).length > 0;
      const matchesQuality =
        qualityFilter === 'ready' ? !hasIssues && Number(dataset.rows_count || 0) > 0 :
        qualityFilter === 'issues' ? hasIssues :
        qualityFilter === 'empty' ? Number(dataset.rows_count || 0) === 0 : true;
      return matchesSearch && matchesType && matchesQuality;
    });
  }, [datasets, qualityFilter, search, typeFilter]);

  const handleUpload = async (file) => {
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      const response = await tourismAPI.uploadCsvDataset(file, datasetType);
      const uploaded = response?.data?.meta;
      setDatasets((prev) => [uploaded, ...prev.filter((item) => item.id !== uploaded.id)]);
      setSelectedDataset(response?.data?.meta || null);
      setPreviewRows(response?.data?.sample_rows || []);
      toast.success('CSV-файл загружен и проверен');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Ошибка загрузки CSV:', err);
      const message = err?.response?.data?.detail || 'Не удалось загрузить CSV';
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async (dataset) => {
    try {
      setError('');
      const response = await tourismAPI.previewCsvDataset(dataset.id);
      setSelectedDataset(response?.data?.meta || dataset);
      setPreviewRows(response?.data?.sample_rows || []);
    } catch (err) {
      console.error('Ошибка предпросмотра CSV:', err);
      setError(err?.response?.data?.detail || 'Не удалось открыть предпросмотр');
    }
  };

  const handleDelete = async (dataset) => {
    if (!window.confirm(`Удалить CSV-файл «${dataset.original_filename}»?`)) return;

    try {
      await tourismAPI.deleteCsvDataset(dataset.id);
      setDatasets((prev) => prev.filter((item) => item.id !== dataset.id));
      if (selectedDataset?.id === dataset.id) {
        setSelectedDataset(null);
        setPreviewRows([]);
      }
      toast.success('CSV-файл удалён');
    } catch (err) {
      console.error('Ошибка удаления CSV:', err);
      const message = err?.response?.data?.detail || 'Не удалось удалить CSV';
      setError(message);
      toast.error(message);
    }
  };

  const handleDownload = async (dataset) => {
    try {
      await tourismAPI.downloadCsvDataset(dataset.id, dataset.original_filename || 'dataset.csv');
    } catch (err) {
      console.error('Ошибка скачивания CSV:', err);
      setError(err?.response?.data?.detail || 'Не удалось скачать CSV');
    }
  };

  const columns = selectedDataset?.columns || [];
  const selectedScore = getQualityScore(selectedDataset);
  const selectedIssues = selectedDataset?.issues || [];

  if (loading) {
    return <div className="page-shell admin-data-page"><div className="home-empty">Загрузка CSV-центра...</div></div>;
  }

  return (
    <div className="page-shell admin-data-page admin-data-page--midnight">
      <section className="admin-data-hero admin-data-hero--pro">
        <div>
          <span className="home-hero__eyebrow">Data Control / CSV</span>
          <h1>CSV-центр контроля данных</h1>
          <p>
            Профессиональная зона для внешних табличных источников: загрузка CSV, паспорт файла,
            проверка качества, предпросмотр, скачивание и подготовка данных для отчётов или ML-аналитики.
          </p>
        </div>
        <div className="admin-data-hero__meta">
          <span>Доступ</span>
          <strong>{currentUser?.role === 'admin' ? 'Администратор' : 'Аналитик'}</strong>
          <small>Менеджер работает с турами и заявками, а CSV-центр остаётся инструментом аналитика/админа.</small>
        </div>
      </section>

      <section className="admin-data-stats">
        <DataStat title="CSV-файлов" value={summary.files} hint="загружено" />
        <DataStat title="Готовы" value={summary.ready} hint="без замечаний" tone="ok" />
        <DataStat title="Строк данных" value={summary.rows.toLocaleString('ru-RU')} hint="суммарно" />
        <DataStat title="Объём" value={formatBytes(summary.size)} hint="на сервере" />
        <DataStat title="Есть замечания" value={summary.withIssues} hint="требуют проверки" tone={summary.withIssues ? 'warning' : 'ok'} />
      </section>

      <section className="admin-data-purpose-grid admin-data-purpose-grid--pro">
        <div className="admin-data-purpose-card admin-data-purpose-card--main">
          <span className="home-hero__eyebrow">Зачем нужен CSV-центр</span>
          <h2>Контроль внешних данных до попадания в аналитику</h2>
          <p>
            В реальной туристической компании часть информации приходит из Excel/CSV: продажи из другой системы,
            маркетинговые источники, клиенты, исторические бронирования. CSV-центр нужен, чтобы такие файлы не загружались
            вслепую: сначала система проверяет структуру и качество, показывает паспорт данных и только потом файл можно использовать.
          </p>
        </div>
        <DataPurpose title="1. Загрузка" text="Админ или аналитик добавляет CSV и указывает тип данных: бронирования, клиенты, маркетинг или ML-датасет." />
        <DataPurpose title="2. Валидация" text="Система считает строки, столбцы, размер, замечания и показывает первые записи для ручной проверки." />
        <DataPurpose title="3. Использование" text="Файл можно скачать, приложить к отчёту, сверить с данными приложения или использовать как источник для MetricBot." />
      </section>

      <section className="admin-data-upload-panel admin-data-upload-panel--pro">
        <div>
          <h2>Загрузить CSV для контроля</h2>
          <p>
            Используйте UTF-8 и строку заголовков. После загрузки откроется паспорт файла: качество, структура,
            замечания и предпросмотр первых строк.
          </p>
        </div>
        <div className="admin-data-upload-panel__actions">
          <select value={datasetType} onChange={(event) => setDatasetType(event.target.value)}>
            <option value="analytics">Аналитический датасет</option>
            <option value="bookings">Бронирования</option>
            <option value="clients">Клиенты</option>
            <option value="marketing">Маркетинг</option>
            <option value="other">Другое</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
          <button className="site-button site-button--primary" type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Загрузка...' : 'Выбрать CSV'}
          </button>
        </div>
      </section>

      <section className="admin-data-filters-panel">
        <div className="admin-data-filter-field admin-data-filter-field--wide">
          <label>Поиск по файлу, столбцам или автору</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например: bookings, email, marketing..." />
        </div>
        <div className="admin-data-filter-field">
          <label>Тип данных</label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Все типы</option>
            {datasetTypes.map((type) => <option key={type} value={type}>{datasetTypeLabels[type] || type}</option>)}
          </select>
        </div>
        <div className="admin-data-filter-field">
          <label>Качество</label>
          <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
            <option value="">Любое</option>
            <option value="ready">Готовые</option>
            <option value="issues">Есть замечания</option>
            <option value="empty">Пустые</option>
          </select>
        </div>
        <button className="site-button site-button--secondary" type="button" onClick={() => { setSearch(''); setTypeFilter(''); setQualityFilter(''); }}>
          Сбросить
        </button>
      </section>

      {error && <div className="detail-alert detail-alert--error">{error}</div>}

      <section className="admin-data-layout admin-data-layout--pro">
        <div className="admin-data-table-card">
          <div className="admin-data-card-head">
            <div>
              <span className="home-hero__eyebrow">Datasets</span>
              <h2>Загруженные CSV</h2>
              <p>Найдено: {filteredDatasets.length} из {datasets.length}</p>
            </div>
            <button className="site-button site-button--secondary" type="button" onClick={loadData}>Обновить</button>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Файл</th>
                  <th>Тип</th>
                  <th>Строки</th>
                  <th>Столбцы</th>
                  <th>Качество</th>
                  <th>Загружен</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.length === 0 ? (
                  <tr><td colSpan="7"><div className="admin-tours-empty-row">CSV-файлы по фильтрам не найдены</div></td></tr>
                ) : filteredDatasets.map((dataset) => {
                  const score = getQualityScore(dataset);
                  return (
                    <tr key={dataset.id} className={selectedDataset?.id === dataset.id ? 'admin-data-row--active' : ''}>
                      <td><strong>{dataset.original_filename}</strong><span className="admin-data-subtext">{formatBytes(dataset.size_bytes)} · {dataset.uploaded_by_name || '—'}</span></td>
                      <td>{datasetTypeLabels[dataset.dataset_type] || dataset.dataset_type}</td>
                      <td>{Number(dataset.rows_count || 0).toLocaleString('ru-RU')}</td>
                      <td>{dataset.columns_count || 0}</td>
                      <td>
                        <span className={`admin-data-quality-pill ${score < 70 ? 'admin-data-quality-pill--warning' : 'admin-data-quality-pill--ok'}`}>{score}%</span>
                      </td>
                      <td>{formatDate(dataset.created_at)}</td>
                      <td>
                        <div className="admin-tours-actions">
                          <button className="site-button site-button--secondary" type="button" onClick={() => openPreview(dataset)}>Открыть</button>
                          <button className="site-button site-button--ghost" type="button" onClick={() => handleDownload(dataset)}>Скачать</button>
                          <button className="site-button site-button--danger" type="button" onClick={() => handleDelete(dataset)}>Удалить</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="admin-data-preview-card admin-data-preview-card--pro">
          <div className="admin-data-card-head admin-data-card-head--stacked">
            <span className="home-hero__eyebrow">Data passport</span>
            <h2>Паспорт набора данных</h2>
            <p>{selectedDataset ? selectedDataset.original_filename : 'Выберите CSV-файл, чтобы посмотреть структуру.'}</p>
          </div>

          {selectedDataset ? (
            <>
              <div className="admin-data-passport-grid">
                <DataPassport label="Качество" value={`${selectedScore}%`} tone={selectedScore < 70 ? 'warning' : 'ok'} />
                <DataPassport label="Строк" value={Number(selectedDataset.rows_count || 0).toLocaleString('ru-RU')} />
                <DataPassport label="Столбцов" value={selectedDataset.columns_count || 0} />
                <DataPassport label="Размер" value={formatBytes(selectedDataset.size_bytes)} />
              </div>

              <div className="admin-data-columns">
                {columns.slice(0, 18).map((column) => <span key={column}>{column}</span>)}
                {columns.length > 18 && <span>+{columns.length - 18}</span>}
              </div>

              <div className="admin-data-action-strip">
                <button className="site-button site-button--secondary" type="button" onClick={() => navigate('/admin/reports')}>К отчётам</button>
                <button className="site-button site-button--secondary" type="button" onClick={() => navigate('/admin/analytics')}>К аналитике</button>
                <button className="site-button site-button--ghost" type="button" onClick={() => handleDownload(selectedDataset)}>Скачать исходник</button>
              </div>

              {selectedIssues.length > 0 ? (
                <div className="admin-data-issues">
                  {selectedIssues.map((issue) => <div key={issue}>• {issue}</div>)}
                </div>
              ) : (
                <div className="admin-data-issues admin-data-issues--ok">Критичных замечаний не найдено. Файл можно использовать для сверки и отчётов.</div>
              )}

              <div className="admin-data-preview-scroll">
                <table className="admin-data-table admin-data-table--compact">
                  <thead>
                    <tr>{columns.slice(0, 6).map((column) => <th key={column}>{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 8).map((row, index) => (
                      <tr key={`row-${index}`}>
                        {columns.slice(0, 6).map((column) => <td key={column}>{String(row[column] ?? '').slice(0, 80)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="home-empty">Нет выбранного файла</div>
          )}
        </aside>
      </section>
    </div>
  );
};

const DataStat = ({ title, value, hint, tone }) => (
  <div className={`admin-data-stat ${tone ? `admin-data-stat--${tone}` : ''}`}>
    <span>{title}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </div>
);

const DataPurpose = ({ title, text }) => (
  <div className="admin-data-purpose-card">
    <strong>{title}</strong>
    <span>{text}</span>
  </div>
);

const DataPassport = ({ label, value, tone }) => (
  <div className={`admin-data-passport ${tone ? `admin-data-passport--${tone}` : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export default AdminDataControl;
