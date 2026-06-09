import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveMediaUrl, tourismAPI } from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useFavorites } from '../components/FavoritesContext';
import { useToast } from '../components/ToastContext';

const FALLBACK_IMAGE = 'https://via.placeholder.com/1200x800?text=Tour';

const getApiMethod = (names) => {
  for (const name of names) {
    if (typeof tourismAPI[name] === 'function') {
      return tourismAPI[name];
    }
  }

  return null;
};

const formatMoney = (value) => {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
};

const formatDate = (value) => {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const buildImageSrc = (tour) => {
  if (!tour) return FALLBACK_IMAGE;

  if (tour.image_data) {
    return `data:${tour.image_type || 'image/jpeg'};base64,${tour.image_data}`;
  }

  if (tour.image_url) {
    return resolveMediaUrl(tour.image_url);
  }

  if (tour.id && typeof tourismAPI.getTourImageUrl === 'function') {
    return tourismAPI.getTourImageUrl(tour.id);
  }

  return FALLBACK_IMAGE;
};

const buildMapUrl = (tour, extraText = '') => {
  const query = [tour?.city, tour?.country, extraText].filter(Boolean).join(', ');

  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(query)}&z=11`;
};

const TourDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { isAuthenticated, currentUser } = useAuth();
  const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();

  const [tour, setTour] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeInfoBlock, setActiveInfoBlock] = useState(null);

  const [peopleCount, setPeopleCount] = useState(1);
  const [bookingVisible, setBookingVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const loadTour = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const getTourMethod = getApiMethod([
        'getTourById',
        'getTour',
        'getTourDetails',
      ]);

      if (!getTourMethod) {
        throw new Error('В tourismAPI не найден метод получения тура');
      }

      const tourResponse = await getTourMethod(Number(id));
      const tourData = tourResponse?.data || null;

      setTour(tourData);

      const getReviewsMethod = getApiMethod([
        'getReviews',
        'getTourReviews',
      ]);

      if (getReviewsMethod) {
        try {
          const reviewsResponse = await getReviewsMethod({
            tour_id: Number(id),
          });

          const payload = reviewsResponse?.data;

          if (Array.isArray(payload)) {
            setReviews(
              payload.filter((review) => Number(review.tour_id) === Number(id))
            );
          } else {
            setReviews([]);
          }
        } catch (error) {
          console.error('Ошибка загрузки отзывов:', error);
          setReviews([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки тура:', error);
      setPageError('Не удалось загрузить страницу тура');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [tour?.id]);

  const galleryImages = useMemo(() => {
    if (!tour) return [FALLBACK_IMAGE];

    const images = [
      buildImageSrc(tour),
      tour.gallery_image_1,
      tour.gallery_image_2,
      tour.gallery_image_3,
      tour.gallery_image_4,
    ].filter(Boolean);

    return [...new Set(images)].length ? [...new Set(images)] : [FALLBACK_IMAGE];
  }, [tour]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return Number(tour?.rating || 0);

    const total = reviews.reduce((sum, review) => {
      return sum + Number(review.rating || 0);
    }, 0);

    return total / reviews.length;
  }, [reviews, tour]);

  const availablePlaces = useMemo(() => {
    if (!tour) return 0;

    if (tour.available_places !== undefined && tour.available_places !== null) {
      return Number(tour.available_places);
    }

    if (tour.free_places !== undefined && tour.free_places !== null) {
      return Number(tour.free_places);
    }

    return Number(tour.max_people || 0);
  }, [tour]);

  const includedBlocks = useMemo(() => {
    if (!tour) return [];

    return [
      {
        key: 'accommodation',
        icon: '🛏️',
        title: 'Проживание',
        text:
          tour.accommodation ||
          'Информация о проживании будет уточнена менеджером после подтверждения заявки.',
        mapHint: 'отель проживание',
      },
      {
        key: 'meals',
        icon: '🍽️',
        title: 'Питание',
        text:
          tour.meals ||
          'Базовое питание зависит от формата тура и выбранного размещения.',
        mapHint: 'рестораны кафе',
      },
      {
        key: 'activities',
        icon: '🎯',
        title: 'Активности',
        text:
          tour.activities ||
          'Экскурсионные и свободные активности будут доступны по программе тура.',
        mapHint: 'достопримечательности развлечения',
      },
      {
        key: 'resort_info',
        icon: '🗺️',
        title: 'О курорте',
        text:
          tour.resort_info ||
          `Актуальная информация о направлении ${tour.city || ''}, ${
            tour.country || ''
          }: сезонность, особенности отдыха и рекомендации перед поездкой.`,
        mapHint: 'центр',
      },
    ];
  }, [tour]);

  const selectedBlock = includedBlocks.find((block) => block.key === activeInfoBlock);

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      toast.warning('Войдите в аккаунт, чтобы добавить тур в избранное');
      navigate('/login');
      return;
    }

    if (!tour?.id) return;

    try {
      setFavoriteLoading(true);

      if (isFavorite(tour.id)) {
        await removeFromFavorites(tour.id);
        toast.success('Тур удалён из избранного');
      } else {
        await addToFavorites(tour.id);
        toast.success('Тур добавлен в избранное');
      }
    } catch (error) {
      console.error('Ошибка работы с избранным:', error);
      toast.error('Не удалось изменить избранное');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleStartBooking = () => {
    if (!isAuthenticated) {
      toast.warning('Для бронирования нужно войти в аккаунт');
      navigate('/login');
      return;
    }

    setBookingVisible(true);
  };

  const handleCreateBooking = async () => {
    if (!tour?.id) return;

    if (!peopleCount || Number(peopleCount) <= 0) {
      toast.error('Укажите корректное количество человек');
      return;
    }

    if (Number(peopleCount) > availablePlaces) {
      toast.error(`Свободно только ${availablePlaces} мест`);
      return;
    }

    try {
      setBookingLoading(true);

      const createBookingMethod = getApiMethod([
        'createBooking',
        'bookTour',
        'createTourBooking',
      ]);

      if (!createBookingMethod) {
        throw new Error('В tourismAPI не найден метод создания бронирования');
      }

      await createBookingMethod({
        tour_id: Number(tour.id),
        people_count: Number(peopleCount),
      });

      toast.success('Бронирование создано');
      navigate('/bookings');
    } catch (error) {
      console.error('Ошибка бронирования:', error);
      toast.error(
        error?.response?.data?.detail || 'Не удалось создать бронирование'
      );
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="tour-detail-page">
        <div className="page-shell">
          <div className="home-empty">Загрузка тура...</div>
        </div>
      </main>
    );
  }

  if (pageError || !tour) {
    return (
      <main className="tour-detail-page">
        <div className="page-shell">
          <div className="detail-alert detail-alert--error">
            {pageError || 'Тур не найден'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="tour-detail-page">
      <div className="page-shell">
        <section className="tour-detail-hero">
          <div className="tour-detail-gallery">
            <div className="tour-detail-gallery__main">
              <img
                src={galleryImages[activeImageIndex]}
                alt={tour.title}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
              />

              <button
                type="button"
                className="tour-detail-favorite"
                onClick={handleToggleFavorite}
                disabled={favoriteLoading}
                aria-label="Избранное"
              >
                {isFavorite(tour.id) ? '♥' : '♡'}
              </button>

              <div className="tour-detail-gallery__badge">
                <strong>{formatMoney(tour.price)}</strong>
                <span>{tour.duration} дн.</span>
                <span>★ {Number(averageRating || 0).toFixed(1)}</span>
                <span>{reviews.length} отзывов</span>
              </div>
            </div>

            {galleryImages.length > 1 && (
              <div className="tour-detail-gallery__thumbs">
                {galleryImages.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    className={
                      activeImageIndex === index
                        ? 'tour-detail-gallery__thumb is-active'
                        : 'tour-detail-gallery__thumb'
                    }
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={image} alt={`${tour.title} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="tour-detail-summary">
            <span className="home-hero__eyebrow">Детали путешествия</span>

            <h1>{tour.title}</h1>

            <p className="tour-detail-summary__location">
              {tour.city}, {tour.country}
            </p>

            <p className="tour-detail-summary__description">
              {tour.description || 'Описание тура пока не добавлено.'}
            </p>

            <div className="tour-detail-facts">
              <div>
                <span>Дата начала</span>
                <strong>{formatDate(tour.start_date)}</strong>
              </div>

              <div>
                <span>Дата окончания</span>
                <strong>{formatDate(tour.end_date)}</strong>
              </div>

              <div>
                <span>Длительность</span>
                <strong>{tour.duration} дней</strong>
              </div>

              <div>
                <span>Свободно мест</span>
                <strong>
                  {availablePlaces} из {tour.max_people}
                </strong>
              </div>
            </div>

            <div className="tour-detail-summary__actions">
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={handleStartBooking}
                disabled={availablePlaces <= 0}
              >
                {availablePlaces > 0 ? 'Забронировать тур' : 'Мест нет'}
              </button>

              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => navigate('/tours')}
              >
                Назад к каталогу
              </button>
            </div>
          </div>
        </section>

        <section className="tour-detail-layout">
          <div className="tour-detail-main">
            <section className="tour-detail-card">
              <h2>Программа тура</h2>
              <p>
                {tour.program ||
                  'Программа формируется по дням и может включать обзорные прогулки, свободное время и дополнительные экскурсии.'}
              </p>

              {tour.program_details && (
                <p className="tour-detail-muted">{tour.program_details}</p>
              )}
            </section>

            <section className="tour-detail-card">
              <h2>Что входит в тур</h2>

              <div className="tour-include-grid">
                {includedBlocks.map((block) => (
                  <button
                    type="button"
                    key={block.key}
                    className="tour-include-card"
                    onClick={() => setActiveInfoBlock(block.key)}
                  >
                    <span>{block.icon}</span>
                    <strong>{block.title}</strong>
                    <p>{block.text}</p>
                    <em>Открыть подробнее</em>
                  </button>
                ))}
              </div>
            </section>

            <section className="tour-detail-card">
              <h2>Локация на карте</h2>

              <div className="tour-map">
                <iframe
                  title={`Карта ${tour.title}`}
                  src={buildMapUrl(tour)}
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </section>

            <section className="tour-detail-card">
              <div className="tour-detail-section-head">
                <div>
                  <h2>Отзывы</h2>
                  <p>
                    Средний рейтинг: <strong>{Number(averageRating || 0).toFixed(1)}</strong> ·{' '}
                    {reviews.length} отзывов
                  </p>
                </div>

                {isAuthenticated && currentUser?.role === 'client' && (
                  <button
                    type="button"
                    className="site-button site-button--secondary"
                    onClick={() => navigate(`/tours/${tour.id}/review`)}
                  >
                    Оставить отзыв
                  </button>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="home-empty">Пока нет отзывов. Будьте первым.</div>
              ) : (
                <div className="tour-reviews-list">
                  {reviews.map((review) => (
                    <article key={review.id} className="tour-review-card">
                      <div>
                        <strong>
                          {review.user_first_name || 'Пользователь'}{' '}
                          {review.user_last_name || ''}
                        </strong>
                        <span>★ {Number(review.rating || 0).toFixed(1)}</span>
                      </div>
                      <p>{review.comment || 'Без комментария'}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="tour-detail-sidebar">
            <section className="tour-detail-card tour-detail-sticky">
              <h2>Кратко о туре</h2>

              <div className="tour-summary-list">
                <div>
                  <span>Стоимость</span>
                  <strong>{formatMoney(tour.price)}</strong>
                </div>

                <div>
                  <span>Направление</span>
                  <strong>
                    {tour.city}, {tour.country}
                  </strong>
                </div>

                <div>
                  <span>Даты</span>
                  <strong>
                    {formatDate(tour.start_date)} — {formatDate(tour.end_date)}
                  </strong>
                </div>

                <div>
                  <span>Свободно мест</span>
                  <strong>
                    {availablePlaces} из {tour.max_people}
                  </strong>
                </div>

                <div>
                  <span>Отзывы</span>
                  <strong>{reviews.length}</strong>
                </div>
              </div>

              <button
                type="button"
                className="site-button site-button--primary tour-detail-sidebar__button"
                onClick={handleStartBooking}
                disabled={availablePlaces <= 0}
              >
                Забронировать
              </button>

              {bookingVisible && (
                <div className="tour-booking-box">
                  <h3>Бронирование тура</h3>

                  <label>
                    Количество человек
                    <input
                      type="number"
                      min="1"
                      max={availablePlaces}
                      value={peopleCount}
                      onChange={(event) => setPeopleCount(event.target.value)}
                    />
                  </label>

                  <div className="tour-booking-box__price">
                    <span>Цена за человека</span>
                    <strong>{formatMoney(tour.price)}</strong>
                  </div>

                  <div className="tour-booking-box__total">
                    <span>Итого</span>
                    <strong>
                      {formatMoney(Number(tour.price || 0) * Number(peopleCount || 0))}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="site-button site-button--primary"
                    onClick={handleCreateBooking}
                    disabled={bookingLoading}
                  >
                    {bookingLoading ? 'Создание...' : 'Подтвердить бронирование'}
                  </button>
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>

      {selectedBlock && (
        <div
          className="tour-info-modal"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveInfoBlock(null);
            }
          }}
        >
          <div className="tour-info-modal__panel">
            <button
              type="button"
              className="tour-info-modal__close"
              onClick={() => setActiveInfoBlock(null)}
            >
              ×
            </button>

            <span className="home-hero__eyebrow">Подробнее</span>

            <h2>
              {selectedBlock.icon} {selectedBlock.title}
            </h2>

            <p>{selectedBlock.text}</p>

            <div className="tour-map">
              <iframe
                title={`${selectedBlock.title} на карте`}
                src={buildMapUrl(tour, selectedBlock.mapHint)}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TourDetail;
