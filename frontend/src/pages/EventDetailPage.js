import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveMediaUrl, tourismAPI } from '../services/api';

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await tourismAPI.getEventById(id);
      setEvent(response.data || null);
    } catch (err) {
      console.error('Ошибка загрузки мероприятия:', err);
      setError('Не удалось загрузить страницу мероприятия');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadEvent();
  }, [loadEvent]);

  const imageSrc = useMemo(() => {
    if (event?.image_data) {
      return `data:${event.image_type || 'image/jpeg'};base64,${event.image_data}`;
    }

    if (event?.image_url) {
      return resolveMediaUrl(event.image_url);
    }

    return 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1400&q=80';
  }, [event]);

  const formatDate = (value) => {
    if (!value) return 'Дата уточняется';

    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatEventTypeLabel = (value) => {
    switch (value) {
      case 'news':
        return 'Новости';
      case 'promo':
        return 'Акции';
      case 'webinar':
        return 'Вебинары';
      case 'update':
        return 'Обновления';
      default:
        return value || 'Событие';
    }
  };

  const formatFormatTypeLabel = (value) => {
    switch (value) {
      case 'online':
        return 'Онлайн';
      case 'offline':
        return 'Офлайн';
      case 'info':
        return 'Инфо';
      default:
        return value || 'Формат';
    }
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
        <div className="home-empty" style={{ color: '#dc2626' }}>
          {error || 'Мероприятие не найдено'}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell event-detail-page">
      <div className="event-detail-back">
        <button
          type="button"
          className="site-button site-button--secondary"
          onClick={() => navigate('/events')}
        >
          Назад к мероприятиям
        </button>
      </div>

      <section className="event-detail-hero">
        <div className="event-detail-hero__image-wrap">
          <img src={imageSrc} alt={event.title} className="event-detail-hero__image" />
        </div>

        <div className="event-detail-hero__content">
          <div className="event-detail-hero__meta">
            <span>{formatEventTypeLabel(event.event_type)}</span>
            <span>{formatFormatTypeLabel(event.format_type)}</span>
            <span>{formatDate(event.start_date)}</span>
          </div>

          <h1>{event.title}</h1>

          <p>
            {event.summary ||
              'Информационный материал Travel Agency для клиентов и сотрудников.'}
          </p>

          <p className="event-detail-hero__location">
            {[event.city, event.country].filter(Boolean).join(', ') || 'Travel Agency'}
          </p>
        </div>
      </section>

      <section className="event-detail-content">
        <div className="event-detail-content__main">
          <h2>Полное описание</h2>

          <div className="event-detail-content__text">
            {(event.content || '')
              .split('\n')
              .filter((item) => item.trim())
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default EventDetailPage;
