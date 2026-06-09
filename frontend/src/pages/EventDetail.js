import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveMediaUrl, tourismAPI } from '../services/api';

const eventTypeMap = {
  news: 'Новости',
  promo: 'Акции',
  webinar: 'Вебинары',
  update: 'Travel Updates',
};

const formatTypeMap = {
  online: 'Онлайн',
  offline: 'Офлайн',
  info: 'Информационное',
};

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await tourismAPI.getEvent(id);
      setEvent(response.data);
    } catch (err) {
      console.error('Ошибка загрузки мероприятия:', err);
      setError(err.response?.data?.detail || 'Не удалось загрузить мероприятие');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const getImageSrc = () => {
    if (!event) return '';
    if (event.image_data) {
      return `data:${event.image_type || 'image/jpeg'};base64,${event.image_data}`;
    }
    if (event.image_url) return resolveMediaUrl(event.image_url);
    return 'https://via.placeholder.com/1600x900?text=Event';
  };

  const formatDateRange = () => {
    if (!event?.start_date) return 'Дата уточняется';

    const start = new Date(event.start_date).toLocaleDateString('ru-RU');
    if (!event.end_date) return start;

    const end = new Date(event.end_date).toLocaleDateString('ru-RU');
    return `${start} — ${end}`;
  };

  if (loading) {
    return (
      <div className="page-shell event-detail-page">
        <div className="home-empty">Загрузка мероприятия...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page-shell event-detail-page">
        <div className="detail-alert detail-alert--error">
          {error || 'Мероприятие не найдено'}
        </div>
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      <div className="page-shell">
        <button
          type="button"
          className="site-button site-button--secondary event-detail-back"
          onClick={() => navigate('/events')}
        >
          Назад к мероприятиям
        </button>

        <section className="event-detail-hero">
          <div className="event-detail-hero__image-wrap">
            <img src={getImageSrc()} alt={event.title} className="event-detail-hero__image" />
          </div>

          <div className="event-detail-hero__content">
            <div className="event-detail-hero__meta">
              <span>{eventTypeMap[event.event_type] || event.event_type}</span>
              <span>{formatTypeMap[event.format_type] || 'Событие'}</span>
              <span>{formatDateRange()}</span>
            </div>

            <h1>{event.title}</h1>
            <p>{event.summary || 'Подробная информация о событии и его содержании.'}</p>

            <div className="event-detail-hero__location">
              {event.country || event.city ? `${event.city || ''}${event.city && event.country ? ', ' : ''}${event.country || ''}` : 'Локация уточняется'}
            </div>
          </div>
        </section>

        <section className="event-detail-content">
          <div className="event-detail-content__main">
            <h2>Описание</h2>
            <div className="event-detail-content__text">
              {(event.content || '').split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EventDetail;
