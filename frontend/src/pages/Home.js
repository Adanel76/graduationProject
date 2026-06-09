import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TourCard from '../components/TourCard';
import {
  FALLBACK_TOUR_IMAGE,
  getTourCardImageSrc,
  tourismAPI,
} from '../services/api';

const AUTOPLAY_DELAY = 5500;

const Home = () => {
  const navigate = useNavigate();

  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);


  const loadTours = useCallback(async () => {
    try {
      setLoading(true);
      const [toursResponse, eventsResponse] = await Promise.all([
        tourismAPI.getLightTours({
          limit: 12,
          sort_by: 'created_at',
          sort_order: 'desc',
        }),
        tourismAPI.getEvents({ limit: 6 }),
      ]);
      setTours(Array.isArray(toursResponse.data) ? toursResponse.data : []);
      setEvents(Array.isArray(eventsResponse.data) ? eventsResponse.data : []);
    } catch (error) {
      console.error('Ошибка загрузки главной страницы:', error);
      setTours([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const featuredTours = useMemo(() => {
    return [...tours].slice(0, 3);
  }, [tours]);

  const popularDirections = useMemo(() => {
    const unique = [];
    const seen = new Set();

    for (const tour of tours) {
      const key = `${tour.country}-${tour.city}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tour);
      }
      if (unique.length === 6) break;
    }

    return unique;
  }, [tours]);

  const heroTours = useMemo(() => {
    if (popularDirections.length > 0) {
      return popularDirections;
    }
    return tours.slice(0, 5);
  }, [popularDirections, tours]);

  const currentHeroTour = heroTours[heroIndex] || null;

  useEffect(() => {
    if (heroTours.length === 0) {
      setHeroIndex(0);
      return;
    }

    if (heroIndex > heroTours.length - 1) {
      setHeroIndex(0);
    }
  }, [heroIndex, heroTours]);

  useEffect(() => {
    if (heroPaused || heroTours.length <= 1) return undefined;

    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroTours.length);
    }, AUTOPLAY_DELAY);

    return () => clearInterval(timer);
  }, [heroPaused, heroTours]);

  const getImageSrc = (tour) => {
    return getTourCardImageSrc(tour);
  };


  const goToPrevHero = () => {
    if (heroTours.length <= 1) return;
    setHeroIndex((prev) => (prev - 1 + heroTours.length) % heroTours.length);
  };

  const openCurrentHeroTour = () => {
    if (!currentHeroTour?.id) return;
    navigate(`/tours/${currentHeroTour.id}`);
  };

  const goToNextHero = () => {
    if (heroTours.length <= 1) return;
    setHeroIndex((prev) => (prev + 1) % heroTours.length);
  };

  const goToHeroSlide = (index) => {
    setHeroIndex(index);
  };

  if (loading) {
    return (
      <div className="page-shell home-page">
        <div className="home-empty">Загрузка главной страницы...</div>
      </div>
    );
  }

  return (
    <div className="page-shell home-page">
      <section className="home-hero">
        <div className="home-hero__content">
          <div>
            <span className="home-hero__eyebrow">Туры, отдых и впечатления</span>

            <h1 className="home-hero__title">
              Откройте
              <br />
              мир с нами
            </h1>

            <p className="home-hero__text">
              Travel Agency помогает подобрать направление, посмотреть условия
              поездки, изучить отель, питание, активности и оформить заявку на тур
              в удобном онлайн-сервисе.
            </p>
          </div>

          <div className="home-hero__highlights home-hero__highlights--client">
            <div className="home-hero__stat">
              <div className="home-hero__stat-value">{tours.length}+</div>
              <div className="home-hero__stat-label">актуальных туров</div>
            </div>

            <div className="home-hero__stat">
              <div className="home-hero__stat-value">{events.length}+</div>
              <div className="home-hero__stat-label">новостей и акций</div>
            </div>

            <div className="home-hero__stat">
              <div className="home-hero__stat-value">24/7</div>
              <div className="home-hero__stat-label">доступ к платформе</div>
            </div>
          </div>
        </div>

        <div
          className="home-hero__visual"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          {heroTours.length > 1 && (
            <div className="home-hero__carousel-controls">
              <button
                type="button"
                className="home-hero__control"
                onClick={goToPrevHero}
                aria-label="Предыдущий тур"
              >
                ‹
              </button>

              <button
                type="button"
                className="home-hero__control"
                onClick={goToNextHero}
                aria-label="Следующий тур"
              >
                ›
              </button>
            </div>
          )}

          <img
            key={currentHeroTour?.id || 'hero-fallback'}
            className="home-hero__visual-image"
            src={currentHeroTour ? getImageSrc(currentHeroTour) : FALLBACK_TOUR_IMAGE}
            alt={currentHeroTour?.title || 'Travel'}
          />

          <div
            className="home-hero__overlay-card home-hero__overlay-card--clickable"
            role="button"
            tabIndex={0}
            onClick={openCurrentHeroTour}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openCurrentHeroTour();
              }
            }}
            aria-label={
              currentHeroTour
                ? `Открыть тур ${currentHeroTour.title}`
                : 'Открыть тур'
            }
          >
            <div className="home-hero__overlay-top">
              <div className="home-hero__overlay-main">
                <h3 className="home-hero__overlay-title">
                  {currentHeroTour?.title || 'Лучшие направления сезона'}
                </h3>

                <p className="home-hero__overlay-location">
                  {currentHeroTour
                    ? `${currentHeroTour.city}, ${currentHeroTour.country}`
                    : 'Индивидуальный подбор маршрутов и удобное бронирование'}
                </p>
              </div>

              <div className="site-pill">
                от{' '}
                {currentHeroTour?.price
                  ? `${Number(currentHeroTour.price).toLocaleString('ru-RU')} ₽`
                  : 'лучшей цены'}
              </div>
            </div>

            <p className="home-hero__overlay-description">
              Смотрите даты, стоимость, свободные места и подробности маршрута перед оформлением заявки.
            </p>

            <div className="home-hero__overlay-meta">
              <span className="home-hero__overlay-chip">
                {currentHeroTour?.duration || '—'} дн.
              </span>

              <span className="home-hero__overlay-chip">
                ★ {Number(currentHeroTour?.rating || 0).toFixed(1)}
              </span>

              <span className="home-hero__overlay-chip">
                {currentHeroTour?.review_count || 0} отзывов
              </span>
            </div>

            <div className="home-hero__overlay-bottom">
              <div className="home-hero__dots home-hero__dots--right">
                {heroTours.map((tour, index) => (
                  <button
                    key={tour.id}
                    type="button"
                    className={`home-hero__dot ${
                      heroIndex === index ? 'home-hero__dot--active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToHeroSlide(index);
                    }}
                    aria-label={`Перейти к туру ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-benefit-strip" aria-label="Преимущества сервиса">
        <article className="home-benefit-card">
          <span>01</span>
          <strong>Понятные условия</strong>
          <p>Стоимость, даты, свободные места и детали маршрута видны в карточке тура.</p>
        </article>

        <article className="home-benefit-card">
          <span>02</span>
          <strong>Информация перед заявкой</strong>
          <p>Клиент заранее изучает отель, питание, активности и особенности курорта.</p>
        </article>

        <article className="home-benefit-card">
          <span>03</span>
          <strong>Быстрое оформление</strong>
          <p>Заявка создаётся онлайн, а менеджер получает данные для дальнейшей обработки.</p>
        </article>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2 className="home-section__title">Популярные направления</h2>
            <p className="home-section__text">
              Быстрый доступ к самым востребованным турам и направлениям, которые
              чаще всего выбирают клиенты.
            </p>
          </div>

          <Link to="/tours" className="site-button site-button--secondary">
            Смотреть все
          </Link>
        </div>

        {popularDirections.length === 0 ? (
          <div className="home-empty">Направления пока не добавлены</div>
        ) : (
          <div className="home-directions">
            {popularDirections.map((tour) => (
              <Link
                key={tour.id}
                to={`/tours/${tour.id}`}
                className="home-direction-card"
              >
                <div className="home-direction-card__image">
                  <img src={getImageSrc(tour)} alt={tour.title} loading="lazy" />
                </div>

                <div className="home-direction-card__body">
                  <h3 className="home-direction-card__title">{tour.city}</h3>
                  <div className="home-direction-card__meta">{tour.country}</div>

                  <div className="home-direction-card__bottom">
                    <span className="site-pill">
                      от {Number(tour.price).toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="site-muted">{tour.duration} дн.</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2 className="home-section__title">Почему выбирают нас</h2>
            <p className="home-section__text">
              Всё, что нужно клиенту перед поездкой: понятный каталог, прозрачное бронирование и актуальные новости агентства.
            </p>
          </div>
        </div>

        <div className="home-features">
          <div className="home-feature-card">
            <div className="home-feature-card__icon">✦</div>
            <h3 className="home-feature-card__title">Подбор направлений</h3>
            <p className="home-feature-card__text">
              Популярные города, сезонные предложения и карточки туров с ключевой информацией.
            </p>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-card__icon">⌂</div>
            <h3 className="home-feature-card__title">Детали размещения</h3>
            <p className="home-feature-card__text">
              В туре можно посмотреть отель, адрес, карту, описание и характеристики проживания.
            </p>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-card__icon">✓</div>
            <h3 className="home-feature-card__title">Простая заявка</h3>
            <p className="home-feature-card__text">
              Клиент оформляет бронирование онлайн, а менеджер быстро получает заявку в работу.
            </p>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-card__icon">♡</div>
            <h3 className="home-feature-card__title">Избранное и уведомления</h3>
            <p className="home-feature-card__text">
              Удобно сохранять интересные туры и отслеживать важные изменения по поездке.
            </p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2 className="home-section__title">Новости и события</h2>
            <p className="home-section__text">
              Акции, обновления и полезные материалы, которые помогут выбрать поездку осознанно.
            </p>
          </div>

          <Link to="/events" className="site-button site-button--secondary">
            Все материалы
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="home-empty">Новости пока готовятся к публикации</div>
        ) : (
          <div className="home-news-grid">
            {events.slice(0, 3).map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="home-news-card">
                <span className="home-news-card__type">
                  {event.event_type === 'promo'
                    ? 'Акция'
                    : event.event_type === 'webinar'
                    ? 'Вебинар'
                    : event.event_type === 'update'
                    ? 'Обновление'
                    : 'Новость'}
                </span>
                <h3>{event.title}</h3>
                <p>{event.summary || event.content}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2 className="home-section__title">Популярные туры</h2>
            <p className="home-section__text">
              Актуальные предложения с датами, рейтингом и количеством свободных мест.
            </p>
          </div>

          <Link to="/tours" className="site-button site-button--secondary">
            Перейти в каталог
          </Link>
        </div>

        {featuredTours.length === 0 ? (
          <div className="home-empty">Туры пока отсутствуют</div>
        ) : (
          <div className="home-tours-grid">
            {featuredTours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;