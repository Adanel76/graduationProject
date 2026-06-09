import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminModal from '../components/AdminModal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { useToast } from '../components/ToastContext';
import { resolveMediaUrl, tourismAPI } from '../services/api';

const FALLBACK_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

const EVENT_TYPES = [
  { value: 'news', label: 'Новость' },
  { value: 'promo', label: 'Акция' },
  { value: 'webinar', label: 'Вебинар' },
  { value: 'update', label: 'Обновление' },
];

const FORMAT_TYPES = [
  { value: 'info', label: 'Информационный' },
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Офлайн' },
];

const createInitialForm = () => ({
  title: '',
  summary: '',
  content: '',
  event_type: 'news',
  format_type: 'info',
  country: '',
  city: '',
  start_date: '',
  end_date: '',
  image_url: '',
  image_base64: '',
  image_type: '',
  is_featured: false,
  is_published: true,
  remove_image: false,
});

const normalizeApiError = (error, fallback = 'Произошла ошибка') => {
  const detail = error?.response?.data?.detail;

  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || item?.detail || 'Некорректные данные').join(', ');
  }

  if (typeof detail === 'object') {
    return detail.msg || detail.detail || fallback;
  }

  return fallback;
};

const toDateTimeInputValue = (value) => {
  if (!value) return '';
  const normalized = String(value);
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
};

const formatDate = (value) => {
  if (!value) return 'Дата не указана';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEventImageSrc = (event) => {
  if (event?.image_data) {
    if (String(event.image_data).startsWith('data:')) {
      return event.image_data;
    }

    return `data:${event.image_type || 'image/jpeg'};base64,${event.image_data}`;
  }

  if (event?.image_url) {
    return resolveMediaUrl(event.image_url);
  }

  return FALLBACK_EVENT_IMAGE;
};

const AdminEvents = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirmDialog();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [modalMode, setModalMode] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState(createInitialForm());
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const [meResponse, eventsResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getAdminEvents({ limit: 200 }),
      ]);

      const me = meResponse?.data;
      if (!['admin', 'manager'].includes(me?.role)) {
        navigate('/profile');
        return;
      }

      setEvents(Array.isArray(eventsResponse?.data) ? eventsResponse.data : []);
    } catch (error) {
      console.error('Ошибка загрузки мероприятий:', error);

      if (error?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentUserCache');
        navigate('/login');
        return;
      }

      if (error?.response?.status === 403) {
        navigate('/admin');
        return;
      }

      setPageError(normalizeApiError(error, 'Не удалось загрузить мероприятия'));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...events]
      .filter((event) => {
        const text = [
          event.title,
          event.summary,
          event.content,
          event.country,
          event.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = normalizedSearch ? text.includes(normalizedSearch) : true;
        const matchesType = typeFilter ? event.event_type === typeFilter : true;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [events, search, typeFilter]);

  const stats = useMemo(() => {
    const total = events.length;
    const published = events.filter((event) => event.is_published).length;
    const featured = events.filter((event) => event.is_featured).length;
    const upcoming = events.filter((event) => {
      if (!event.start_date) return false;
      return new Date(event.start_date) >= new Date();
    }).length;

    return { total, published, featured, upcoming };
  }, [events]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageFile = (file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;

      setForm((prev) => ({
        ...prev,
        image_base64: base64,
        image_type: file.type || 'image/jpeg',
        image_url: '',
        remove_image: false,
      }));
    };

    reader.readAsDataURL(file);
  };

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedEvent(null);
    setForm(createInitialForm());
    setModalError('');
    setSaving(false);
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedEvent(null);
    setModalError('');
    setForm(createInitialForm());
  };

  const openEditModal = (event) => {
    setModalMode('edit');
    setSelectedEvent(event);
    setModalError('');
    setForm({
      title: event.title || '',
      summary: event.summary || '',
      content: event.content || '',
      event_type: event.event_type || 'news',
      format_type: event.format_type || 'info',
      country: event.country || '',
      city: event.city || '',
      start_date: toDateTimeInputValue(event.start_date),
      end_date: toDateTimeInputValue(event.end_date),
      image_url: event.image_url || '',
      image_base64: '',
      image_type: '',
      is_featured: Boolean(event.is_featured),
      is_published: Boolean(event.is_published),
      remove_image: false,
    });
  };

  const validateForm = () => {
    if (!form.title.trim()) return 'Введите заголовок мероприятия';
    if (!form.content.trim()) return 'Введите основной текст мероприятия';
    if (!form.event_type) return 'Выберите тип мероприятия';

    if (form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date)) {
      return 'Дата окончания не может быть раньше даты начала';
    }

    return '';
  };

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      content: form.content.trim(),
      event_type: form.event_type,
      format_type: form.format_type || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_featured: Boolean(form.is_featured),
      is_published: Boolean(form.is_published),
    };

    if (modalMode === 'create') {
      payload.image_url = form.image_base64 ? null : form.image_url.trim() || null;
      payload.image_base64 = form.image_base64 || null;
      payload.image_type = form.image_base64 ? form.image_type || 'image/jpeg' : null;
      return payload;
    }

    if (form.remove_image) {
      payload.remove_image = true;
      return payload;
    }

    if (form.image_base64) {
      payload.image_base64 = form.image_base64;
      payload.image_type = form.image_type || 'image/jpeg';
      payload.image_url = null;
      return payload;
    }

    const nextImageUrl = form.image_url.trim();
    const previousImageUrl = selectedEvent?.image_url || '';
    if (nextImageUrl !== previousImageUrl) {
      payload.image_url = nextImageUrl || null;
    }

    return payload;
  };

  const handleSave = async () => {
    const validationError = validateForm();

    if (validationError) {
      setModalError(validationError);
      return;
    }

    try {
      setSaving(true);
      setModalError('');

      const payload = buildPayload();

      if (modalMode === 'create') {
        const response = await tourismAPI.createEvent(payload);
        setEvents((prev) => [response.data, ...prev]);
        toast.success('Мероприятие создано');
      } else if (modalMode === 'edit' && selectedEvent) {
        const response = await tourismAPI.updateEvent(selectedEvent.id, payload);
        setEvents((prev) =>
          prev.map((item) => (Number(item.id) === Number(selectedEvent.id) ? response.data : item))
        );
        toast.success('Мероприятие обновлено');
      }

      closeModal();
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error);
      setModalError(normalizeApiError(error, 'Не удалось сохранить мероприятие'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    const confirmed = await confirm({
      title: 'Удалить мероприятие?',
      message: 'Публикация будет удалена из базы данных и исчезнет из пользовательского раздела.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      await tourismAPI.deleteEvent(eventId);
      setEvents((prev) => prev.filter((item) => Number(item.id) !== Number(eventId)));
      toast.success('Мероприятие удалено');

      if (selectedEvent?.id === eventId) {
        closeModal();
      }
    } catch (error) {
      console.error('Ошибка удаления мероприятия:', error);
      setModalError(normalizeApiError(error, 'Не удалось удалить мероприятие'));
    }
  };

  const previewImage = form.remove_image
    ? FALLBACK_EVENT_IMAGE
    : form.image_base64
    ? `data:${form.image_type || 'image/jpeg'};base64,${form.image_base64}`
    : form.image_url || (selectedEvent ? getEventImageSrc(selectedEvent) : FALLBACK_EVENT_IMAGE);

  if (loading) {
    return (
      <div className="page-shell admin-events-page">
        <div className="home-empty">Загрузка мероприятий...</div>
      </div>
    );
  }

  return (
    <div className="page-shell admin-events-page">
      <section className="admin-tours-hero motion-rise">
        <div>
          <span className="home-hero__eyebrow">Events / Content management</span>
          <h1 className="admin-tours-hero__title">Мероприятия</h1>
          <p className="admin-tours-hero__text">
            Управляйте новостями, акциями, вебинарами и информационными публикациями.
            Весь текст и изображения сохраняются в базе данных и выводятся в клиентском разделе.
          </p>
        </div>

        <div className="admin-tours-hero__stats">
          <div className="compact-stat">
            <span>Всего</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="compact-stat">
            <span>Опубликовано</span>
            <strong>{stats.published}</strong>
          </div>
          <div className="compact-stat">
            <span>В подборке</span>
            <strong>{stats.featured}</strong>
          </div>
          <div className="compact-stat">
            <span>Предстоящие</span>
            <strong>{stats.upcoming}</strong>
          </div>
        </div>
      </section>

      <section className="admin-tours-toolbar motion-fade">
        <div className="admin-tours-toolbar__left">
          <input
            type="text"
            className="admin-table-search"
            placeholder="Поиск по заголовку, тексту, стране или городу..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="admin-tours-toolbar__right">
          <select
            className="admin-tours-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">Все типы</option>
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={() => {
              setSearch('');
              setTypeFilter('');
            }}
          >
            Сбросить
          </button>

          <button
            type="button"
            className="site-button site-button--primary"
            onClick={openCreateModal}
          >
            Создать мероприятие
          </button>
        </div>
      </section>

      {pageError && (
        <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
          {pageError}
        </div>
      )}

      <section className="admin-table-shell motion-fade">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Мероприятие</th>
                <th>Тип</th>
                <th>Дата</th>
                <th>Локация</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>

            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="admin-tours-empty-row">Мероприятия не найдены</div>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <div className="admin-tours-item">
                        <img
                          src={getEventImageSrc(event)}
                          alt={event.title}
                          className="admin-tours-item__image"
                          onError={(error) => {
                            error.currentTarget.src = FALLBACK_EVENT_IMAGE;
                          }}
                        />
                        <div>
                          <strong>{event.title}</strong>
                          <span>{event.summary || 'Краткое описание отсутствует'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-tours-meta">
                        <strong>
                          {EVENT_TYPES.find((type) => type.value === event.event_type)?.label || event.event_type}
                        </strong>
                        <span>
                          {FORMAT_TYPES.find((type) => type.value === event.format_type)?.label || event.format_type || '—'}
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(event.start_date || event.created_at)}</td>
                    <td>
                      <div className="admin-tours-meta">
                        <strong>{event.country || '—'}</strong>
                        <span>{event.city || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-event-statuses">
                        <span className={`ui-chip ${event.is_published ? 'ui-chip--success' : 'ui-chip--danger'}`}>
                          {event.is_published ? 'Опубликовано' : 'Черновик'}
                        </span>
                        {event.is_featured ? <span className="ui-chip">В подборке</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="admin-tours-actions">
                        <button
                          type="button"
                          className="site-button site-button--secondary"
                          onClick={() => openEditModal(event)}
                        >
                          Открыть
                        </button>
                        {event.is_published ? (
                          <button
                            type="button"
                            className="site-button site-button--ghost"
                            onClick={() => navigate(`/events/${event.id}`)}
                          >
                            Просмотр
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="site-button site-button--danger"
                          onClick={() => handleDelete(event.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AdminModal
        open={Boolean(modalMode)}
        onClose={closeModal}
        title={
          modalMode === 'create'
            ? 'Создание мероприятия'
            : selectedEvent
            ? `Редактирование мероприятия #${selectedEvent.id}`
            : 'Редактирование мероприятия'
        }
        size="drawer"
      >
        <div className="admin-tours-drawer__section">
          <span className="home-hero__eyebrow">
            {modalMode === 'create' ? 'Create event' : 'Edit event'}
          </span>
          <p className="site-muted" style={{ marginTop: '12px', marginBottom: 0, lineHeight: 1.7 }}>
            Заполните публикацию, изображение и статус отображения в клиентском разделе.
          </p>
        </div>

        {modalError && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '16px' }}>
            {modalError}
          </div>
        )}

        <div className="admin-tours-drawer__grid">
          <div className="ui-field">
            <label>Заголовок</label>
            <input value={form.title} onChange={(event) => handleChange('title', event.target.value)} />
          </div>

          <div className="ui-field">
            <label>Тип</label>
            <select value={form.event_type} onChange={(event) => handleChange('event_type', event.target.value)}>
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label>Формат</label>
            <select value={form.format_type} onChange={(event) => handleChange('format_type', event.target.value)}>
              {FORMAT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label>Страна</label>
            <input value={form.country} onChange={(event) => handleChange('country', event.target.value)} />
          </div>

          <div className="ui-field">
            <label>Город</label>
            <input value={form.city} onChange={(event) => handleChange('city', event.target.value)} />
          </div>

          <div className="ui-field">
            <label>Дата начала</label>
            <input
              type="datetime-local"
              value={form.start_date}
              onChange={(event) => handleChange('start_date', event.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Дата окончания</label>
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={(event) => handleChange('end_date', event.target.value)}
            />
          </div>

          <div className="admin-event-flags">
            <label className="ui-checkbox">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => handleChange('is_published', event.target.checked)}
              />
              <span>Опубликовано</span>
            </label>

            <label className="ui-checkbox">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) => handleChange('is_featured', event.target.checked)}
              />
              <span>Показывать в подборке</span>
            </label>
          </div>
        </div>

        <div className="admin-tours-drawer__section">
          <div className="ui-field">
            <label>Краткое описание</label>
            <textarea
              rows="3"
              value={form.summary}
              onChange={(event) => handleChange('summary', event.target.value)}
            />
          </div>
        </div>

        <div className="admin-tours-drawer__section">
          <div className="ui-field">
            <label>Основной текст</label>
            <textarea
              rows="8"
              value={form.content}
              onChange={(event) => handleChange('content', event.target.value)}
            />
          </div>
        </div>

        <div className="admin-tours-drawer__media">
          <div className="ui-field">
            <label>URL изображения</label>
            <input
              value={form.image_url}
              onChange={(event) => {
                handleChange('image_url', event.target.value);
                handleChange('remove_image', false);
              }}
            />
          </div>

          <div className="ui-field">
            <label>Загрузить файл</label>
            <input type="file" accept="image/*" onChange={(event) => handleImageFile(event.target.files?.[0])} />
          </div>

          <div className="ui-field admin-tours-image-tools">
            <label>Управление изображением</label>
            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  image_url: '',
                  image_base64: '',
                  image_type: '',
                  remove_image: true,
                }))
              }
            >
              Очистить изображение
            </button>
          </div>
        </div>

        <div className="admin-tours-preview">
          <img
            src={previewImage}
            alt="Preview"
            className="admin-tours-preview__image"
            onError={(error) => {
              error.currentTarget.src = FALLBACK_EVENT_IMAGE;
            }}
          />
        </div>

        <div className="admin-tours-drawer__actions">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {modalMode === 'edit' && selectedEvent?.is_published ? (
              <button
                type="button"
                className="site-button site-button--ghost"
                onClick={() => navigate(`/events/${selectedEvent.id}`)}
                disabled={saving}
              >
                Открыть публикацию
              </button>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {modalMode === 'edit' && selectedEvent ? (
              <button
                type="button"
                className="site-button site-button--danger"
                onClick={() => handleDelete(selectedEvent.id)}
                disabled={saving}
              >
                Удалить
              </button>
            ) : null}

            <button type="button" className="site-button site-button--secondary" onClick={closeModal} disabled={saving}>
              Отмена
            </button>

            <button type="button" className="site-button site-button--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : modalMode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default AdminEvents;
