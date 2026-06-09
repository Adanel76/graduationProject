import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveMediaUrl, tourismAPI } from '../services/api';

const Events = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    eventType: '',
    formatType: '',
    country: '',
    featuredOnly: false,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await tourismAPI.getEvents();
      setEvents(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки мероприятий:', err);
      setError('Не удалось загрузить мероприятия');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventImage = (event) => {
    if (event?.image_data) {
      return `data:${event.image_type || 'image/jpeg'};base64,${event.image_data}`;
    }

    if (event?.image_url) {
      return resolveMediaUrl(event.image_url);
    }

    return 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=80';
  };

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

  const countries = useMemo(() => {
    return [...new Set(events.map((event) => event.country).filter(Boolean))];
  }, [events]);

  const featuredEvent = useMemo(() => {
    const featured = events.find((event) => event.is_featured);
    return featured || events[0] || null;
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (filters.eventType) {
      result = result.filter((event) => event.event_type === filters.eventType);
    }

    if (filters.formatType) {
      result = result.filter((event) => event.format_type === filters.formatType);
    }

    if (filters.country) {
      result = result.filter((event) => event.country === filters.country);
    }

    if (filters.featuredOnly) {
      result = result.filter((event) => event.is_featured);
    }

    return result.filter((event) => featuredEvent?.id !== event.id);
  }, [events, filters, featuredEvent]);

  if (loading) {
    return (
      <div className="page-shell events-page">
        <div className="home-empty">Загрузка мероприятий...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell events-page">
        <div className="home-empty" style={{ color: '#dc2626' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell events-page">
      <section className="events-hero">
        <span className="home-hero__eyebrow">Мероприятия и новости</span>
        <h1 className="events-hero__title">Актуальные события Travel Agency</h1>
        <p className="events-hero__text">
          Здесь можно размещать новости агентства, акции, вебинары, обновления
          системы и информационные публикации для клиентов и сотрудников.
        </p>
      </section>

      <section className="events-filters">
        <div className="events-filters__grid">
          <div className="events-field">
            <label>Тип</label>
            <select
              value={filters.eventType}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, eventType: e.target.value }))
              }
            >
              <option value="">Все типы</option>
              <option value="news">Новости</option>
              <option value="promo">Акции</option>
              <option value="webinar">Вебинары</option>
              <option value="update">Обновления</option>
            </select>
          </div>

          <div className="events-field">
            <label>Формат</label>
            <select
              value={filters.formatType}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, formatType: e.target.value }))
              }
            >
              <option value="">Все форматы</option>
              <option value="online">Онлайн</option>
              <option value="offline">Офлайн</option>
              <option value="info">Инфо</option>
            </select>
          </div>

          <div className="events-field">
            <label>Страна</label>
            <select
              value={filters.country}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, country: e.target.value }))
              }
            >
              <option value="">Все страны</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div className="events-field">
            <label>Подборка</label>
            <button
              type="button"
              className={`events-toggle ${filters.featuredOnly ? 'events-toggle--active' : ''}`}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  featuredOnly: !prev.featuredOnly,
                }))
              }
            >
              {filters.featuredOnly ? 'Только избранные' : 'Показывать все'}
            </button>
          </div>
        </div>

        <div className="events-filters__actions">
          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={() =>
              setFilters({
                eventType: '',
                formatType: '',
                country: '',
                featuredOnly: false,
              })
            }
          >
            Сбросить фильтры
          </button>
        </div>
      </section>

      {featuredEvent && (
        <section
          className="events-featured hover-lift"
          onClick={() => navigate(`/events/${featuredEvent.id}`)}
        >
          <div className="events-featured__image-wrap">
            <img
              src={getEventImage(featuredEvent)}
              alt={featuredEvent.title}
              className="events-featured__image"
            />
          </div>

          <div className="events-featured__content">
            <div className="events-featured__meta">
              <span>{formatEventTypeLabel(featuredEvent.event_type)}</span>
              <span>{formatFormatTypeLabel(featuredEvent.format_type)}</span>
              <span>{formatDate(featuredEvent.start_date)}</span>
            </div>

            <h2>{featuredEvent.title}</h2>
            <p>{featuredEvent.summary || featuredEvent.content}</p>

            <button type="button" className="site-button site-button--primary">
              Открыть материал
            </button>
          </div>
        </section>
      )}

      {filteredEvents.length === 0 ? (
        <div className="home-empty">По текущим фильтрам мероприятий не найдено.</div>
      ) : (
        <section className="events-grid">
          {filteredEvents.map((event) => (
            <article
              key={event.id}
              className="event-card hover-lift"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <div className="event-card__image-wrap">
                <img
                  src={getEventImage(event)}
                  alt={event.title}
                  className="event-card__image"
                />
              </div>

              <div className="event-card__content">
                <div className="event-card__meta">
                  <span>{formatEventTypeLabel(event.event_type)}</span>
                  <span>{formatFormatTypeLabel(event.format_type)}</span>
                </div>

                <h3>{event.title}</h3>
                <p>{event.summary || event.content}</p>

                <div className="event-card__footer">
                  <span>{formatDate(event.start_date)}</span>
                  <strong>
                    {[event.city, event.country].filter(Boolean).join(', ') || 'Travel Agency'}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default Events;
