import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveMediaUrl, tourismAPI } from '../services/api';
import BookingForm from '../components/BookingForm';

const FALLBACK_TOUR_IMAGE =
  'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1400&q=80';

const countryImages = {
  Франция:
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=80',
  Япония:
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1400&q=80',
  Италия:
    'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80',
  США:
    'https://images.unsplash.com/photo-1496588152823-e7d27d7d5f53?auto=format&fit=crop&w=1400&q=80',
  Индонезия:
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80',
  ОАЭ:
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1400&q=80',
  Великобритания:
    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1400&q=80',
  Россия:
    'https://images.unsplash.com/photo-1513326738677-b964603b136d?auto=format&fit=crop&w=1400&q=80',
};

const formatPrice = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

const formatDate = (dateString) => {
  if (!dateString) return '—';

  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const buildTourImageSrc = (tour) => {
  if (!tour) return FALLBACK_TOUR_IMAGE;

  if (tour.image_data) {
    if (String(tour.image_data).startsWith('data:')) {
      return tour.image_data;
    }

    return `data:${tour.image_type || 'image/jpeg'};base64,${tour.image_data}`;
  }

  if (tour.image_url) {
    return resolveMediaUrl(tour.image_url);
  }

  return countryImages[tour.country] || FALLBACK_TOUR_IMAGE;
};

const buildGalleryImageSrc = (image) => {
  if (!image) return '';

  if (image.image_data) {
    if (String(image.image_data).startsWith('data:')) {
      return image.image_data;
    }

    return `data:${image.image_type || 'image/jpeg'};base64,${image.image_data}`;
  }

  return resolveMediaUrl(image.image_url) || '';
};

const buildYandexMapUrl = (tour, hint = '') => {
  const lat = Number(tour?.map_lat);
  const lng = Number(tour?.map_lng);
  const zoom = Number(tour?.map_zoom || 12);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://yandex.ru/map-widget/v1/?ll=${lng},${lat}&z=${zoom}&pt=${lng},${lat},pm2rdm`;
  }

  const query = [tour?.city, tour?.country, hint].filter(Boolean).join(', ');
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(query)}&z=${zoom}`;
};

const buildHotelMapQuery = (tour) =>
  [
    tour?.hotel_address,
    tour?.hotel_name,
    tour?.city,
    tour?.country,
    'отель',
  ]
    .filter(Boolean)
    .join(', ');

const buildHotelYandexMapUrl = (tour) => {
  const lat = Number(tour?.hotel_map_lat);
  const lng = Number(tour?.hotel_map_lng);
  const zoom = Number(tour?.hotel_map_zoom || 15);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://yandex.ru/map-widget/v1/?ll=${lng},${lat}&z=${zoom}&pt=${lng},${lat},pm2rdm`;
  }

  const query = buildHotelMapQuery(tour);
  return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(query)}&z=${zoom}`;
};

const buildHotelYandexMapOpenUrl = (tour) => {
  const lat = Number(tour?.hotel_map_lat);
  const lng = Number(tour?.hotel_map_lng);
  const zoom = Number(tour?.hotel_map_zoom || 15);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://yandex.ru/maps/?ll=${lng},${lat}&z=${zoom}&pt=${lng},${lat},pm2rdm`;
  }

  return `https://yandex.ru/maps/?text=${encodeURIComponent(buildHotelMapQuery(tour))}`;
};

const splitTextBlocks = (value, fallback = '') => {
  const text = String(value || fallback || '').trim();

  if (!text) return [];

  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const splitTextItems = (value, fallback = []) => {
  const text = String(value || '').trim();

  if (!text) return fallback;

  const items = text
    .split(/\n|;|•/)
    .map((item) => item.trim().replace(/^[-–—]\s*/, ''))
    .filter(Boolean);

  return items.length ? items : fallback;
};

const TourDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tour, setTour] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [error, setError] = useState(null);

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeInfoSection, setActiveInfoSection] = useState(null);

  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  const [reviewFormData, setReviewFormData] = useState({
    rating: 5,
    comment: '',
  });

  const loadTour = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tourismAPI.getTourById(id);
      const nextTour = response.data;
      setTour(nextTour);

      if (Array.isArray(nextTour?.gallery_images)) {
        setGallery(nextTour.gallery_images);
      }

      if (typeof tourismAPI.getTourGallery === 'function') {
        try {
          const galleryResponse = await tourismAPI.getTourGallery(id);
          setGallery(Array.isArray(galleryResponse?.data) ? galleryResponse.data : []);
        } catch (galleryError) {
          console.error('Ошибка загрузки галереи тура:', galleryError);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки тура:', err);
      setError('Тур не найден');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const response = await tourismAPI.getReviews();
      const tourReviews = (response.data || []).filter(
        (review) => Number(review.tour_id) === Number(id)
      );
      setReviews(tourReviews);
    } catch (err) {
      console.error('Ошибка загрузки отзывов:', err);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadTour();
    loadReviews();
  }, [loadTour, loadReviews]);

  const galleryImages = useMemo(() => {
    const images = [
      buildTourImageSrc(tour),
      ...gallery.map(buildGalleryImageSrc),
    ].filter(Boolean);

    const uniqueImages = [...new Set(images)];
    return uniqueImages.length ? uniqueImages : [FALLBACK_TOUR_IMAGE];
  }, [tour, gallery]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [tour?.id, galleryImages.length]);


  const availableSeats = useMemo(() => {
    if (!tour) return 0;
    return Number(tour.available_seats ?? tour.available_places ?? tour.max_people ?? 0);
  }, [tour]);

  const includedSections = useMemo(() => {
    if (!tour) return [];

    const location = [tour.city, tour.country].filter(Boolean).join(', ');
    const dateRange = `${formatDate(tour.start_date)} — ${formatDate(tour.end_date)}`;

    return [
      {
        key: 'accommodation',
        icon: '🏨',
        title: 'Проживание',
        summary: 'Карта отеля, адрес, описание и характеристики.',
        hotelName: tour.hotel_name || 'Отель по программе тура',
        hotelAddress: tour.hotel_address || location || 'Адрес уточняется менеджером',
        text:
          tour.hotel_description ||
          tour.accommodation ||
          `Информация об отеле для направления ${location || 'тура'} заполняется менеджером или администратором в карточке тура.`,
        points: splitTextItems(tour.hotel_features, [
          'адрес и координаты отеля указывает менеджер или администратор',
          'условия заселения фиксируются после подтверждения заявки',
          'тип номера и состав услуг зависят от выбранного пакета',
        ]),
        note:
          tour.accommodation ||
          'Данные по проживанию можно обновлять в админке редактирования тура.',
      },
      {
        key: 'meals',
        icon: '🍽',
        title: 'Питание',
        summary: 'Описание программы питания по туру.',
        text:
          tour.meals ||
          'Программа питания пока не заполнена. Менеджер или администратор может добавить формат питания, включённые приёмы пищи и важные условия в админке.',
        points: splitTextItems(tour.meals_features, [
          'формат питания задаётся менеджером или администратором',
          'особые пожелания клиента можно уточнить при бронировании',
          'дополнительные услуги питания согласуются отдельно',
        ]),
        note: 'Описание и особенности питания заполняются в админке редактирования тура.',
      },
      {
        key: 'activities',
        icon: '🎯',
        title: 'Активности',
        summary: 'Программа экскурсий, отдыха и свободного времени.',
        text:
          tour.activities ||
          'Программа активностей пока не заполнена. Менеджер или администратор может добавить экскурсии, свободное время, дополнительные события и условия участия.',
        points: splitTextItems(tour.activities_features, [
          'активности заполняются менеджером или администратором',
          'часть программы может зависеть от сезона и погоды',
          'дополнительные активности подтверждаются менеджером',
        ]),
        note: 'Описание и особенности активностей заполняются в админке редактирования тура.',
      },
      {
        key: 'resort',
        icon: '🗺',
        title: 'О курорте',
        summary: 'Ключевая информация о направлении.',
        text:
          tour.resort_info ||
          `Ключевая информация о направлении ${location || 'тура'} пока не заполнена. Менеджер или администратор может добавить сезонность, особенности отдыха и рекомендации.`,
        points: splitTextItems(tour.resort_features, [
          'страна и город подтягиваются из карточки тура',
          'описание курорта заполняется менеджером или администратором',
          'информация помогает клиенту понять особенности направления',
        ]),
        note: 'Ключевая информация и особенности курорта заполняются в админке редактирования тура.',
        facts: [
          { label: 'Направление', value: location || '—' },
          { label: 'Даты тура', value: dateRange },
          { label: 'Длительность', value: `${tour.duration || 0} дн.` },
          { label: 'Свободно мест', value: `${availableSeats} из ${tour.max_people || 0}` },
        ],
      },
    ];
  }, [tour, availableSeats]);

  useEffect(() => {
    if (!includedSections.length) return;

    setActiveInfoSection((currentSection) => {
      const sectionExists = includedSections.some(
        (section) => section.key === currentSection
      );

      return sectionExists ? currentSection : includedSections[0].key;
    });
  }, [includedSections]);

  const selectedInfoSection = includedSections.find(
    (section) => section.key === activeInfoSection
  );

  const handleBookTour = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setShowBookingForm((prev) => !prev);
  };

  const handleReviewChange = (e) => {
    setReviewFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');

    try {
      const reviewData = {
        tour_id: Number(id),
        rating: Number(reviewFormData.rating),
        comment: reviewFormData.comment.trim(),
      };

      await tourismAPI.createReview(reviewData);

      setReviewFormData({ rating: 5, comment: '' });
      setReviewSuccess('Отзыв успешно отправлен');
      setShowReviewForm(false);

      await Promise.all([loadReviews(), loadTour()]);
    } catch (err) {
      console.error('Ошибка отправки отзыва:', err);

      if (err.response?.status === 400) {
        setReviewError(err.response.data?.detail || 'Отзыв уже существует или данные некорректны');
      } else if (err.response?.status === 401) {
        setReviewError('Необходимо войти в аккаунт');
      } else {
        setReviewError('Ошибка при отправке отзыва');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const showPreviousImage = () => {
    setActiveImageIndex((prev) =>
      prev === 0 ? galleryImages.length - 1 : prev - 1
    );
  };

  const showNextImage = () => {
    setActiveImageIndex((prev) =>
      prev === galleryImages.length - 1 ? 0 : prev + 1
    );
  };

  if (loading) {
    return (
      <div className="page-shell detail-page">
        <div className="home-empty">Загрузка тура...</div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="page-shell detail-page">
        <div className="home-empty" style={{ color: '#dc2626' }}>
          {error || 'Тур не найден'}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell detail-page">
      <section className="detail-hero">
        <div className="detail-hero__image-wrap">
          <img
            src={galleryImages[activeImageIndex]}
            alt={tour.title}
            className="detail-hero__image"
            onError={(event) => {
              event.currentTarget.src = FALLBACK_TOUR_IMAGE;
            }}
          />

          {galleryImages.length > 1 && (
            <>
              <div className="detail-gallery-controls">
                <button
                  type="button"
                  className="detail-gallery-button"
                  onClick={showPreviousImage}
                  aria-label="Предыдущее изображение"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-gallery-button"
                  onClick={showNextImage}
                  aria-label="Следующее изображение"
                >
                  ›
                </button>
              </div>

              <div className="detail-gallery-dots" aria-label="Галерея тура">
                {galleryImages.map((image, index) => (
                  <button
                    type="button"
                    key={`gallery-dot-${index}`}
                    className={
                      activeImageIndex === index
                        ? 'detail-gallery-dot detail-gallery-dot--active'
                        : 'detail-gallery-dot'
                    }
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`Показать изображение ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="detail-hero__floating">
            <div className="detail-hero__floating-price">
              {formatPrice(tour.price)}
            </div>
            <div className="detail-hero__floating-meta">
              <span>{tour.duration} дн.</span>
              <span>★ {Number(tour.rating || 0).toFixed(1)}</span>
              <span>{tour.review_count || 0} отзывов</span>
              <span>мест: {availableSeats}</span>
            </div>
          </div>
        </div>

        <div className="detail-hero__content">
          <span className="home-hero__eyebrow">Детали путешествия</span>

          <h1 className="detail-hero__title">{tour.title}</h1>

          <p className="detail-hero__location">
            {tour.city}, {tour.country}
          </p>

          <p className="detail-hero__description">
            {tour.description || 'Описание тура пока не добавлено.'}
          </p>

          <div className="detail-info-grid">
            <div className="detail-info-card">
              <span className="detail-info-card__label">Дата начала</span>
              <strong>{formatDate(tour.start_date)}</strong>
            </div>

            <div className="detail-info-card">
              <span className="detail-info-card__label">Дата окончания</span>
              <strong>{formatDate(tour.end_date)}</strong>
            </div>

            <div className="detail-info-card">
              <span className="detail-info-card__label">Длительность</span>
              <strong>{tour.duration} дней</strong>
            </div>

            <div className="detail-info-card">
              <span className="detail-info-card__label">Свободно мест</span>
              <strong>{availableSeats} из {tour.max_people}</strong>
            </div>
          </div>

          <div className="detail-hero__actions">
            <button
              type="button"
              className="site-button site-button--primary"
              onClick={handleBookTour}
              disabled={availableSeats <= 0}
            >
              {availableSeats > 0
                ? showBookingForm
                  ? 'Скрыть форму'
                  : 'Забронировать тур'
                : 'Мест нет'}
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

      <section className="detail-layout">
        <div className="detail-main">
          <section className="detail-section">
            <div className="detail-section__head">
              <h2>Программа тура</h2>
            </div>
            <div className="detail-section__content detail-text-block">
              {tour.program ||
                'Программа формируется по дням и может включать обзорные прогулки, свободное время и дополнительные экскурсии.'}
            </div>
          </section>

          <section className="detail-section detail-includes-section">
            <div className="detail-section__head detail-includes-section__head">
              <div>
                <h2>Что входит в тур</h2>
                <p className="site-muted">
                  Выберите блок: для проживания откроется карта отеля, для остальных разделов — подробное описание.
                </p>
              </div>
            </div>

            <div className="detail-includes-grid" role="tablist" aria-label="Разделы тура">
              {includedSections.map((section) => {
                const isActive = activeInfoSection === section.key;

                return (
                  <button
                    type="button"
                    key={section.key}
                    className={
                      isActive
                        ? 'detail-include-card detail-include-card--active'
                        : 'detail-include-card'
                    }
                    onClick={() => setActiveInfoSection(section.key)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span className="detail-include-card__icon">{section.icon}</span>
                    <span className="detail-include-card__content">
                      <strong>{section.title}</strong>
                      <small>{section.summary}</small>
                    </span>
                    <span className="detail-include-card__arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>

            {selectedInfoSection && (
              <article className={`detail-include-panel detail-include-panel--${selectedInfoSection.key}`}>
                <div className="detail-include-panel__header">
                  <span className="home-hero__eyebrow">Выбранный блок</span>
                  <h3>{selectedInfoSection.title}</h3>
                  <p>{selectedInfoSection.summary}</p>
                </div>

                {selectedInfoSection.key === 'accommodation' ? (
                  <>
                    <div className="detail-include-panel__map detail-include-panel__map--full">
                      <div className="detail-include-panel__map-head">
                        <div>
                          <strong>{selectedInfoSection.hotelName}</strong>
                          <span>{selectedInfoSection.hotelAddress}</span>
                        </div>

                        <a
                          href={buildHotelYandexMapOpenUrl(tour)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть в Яндекс.Картах
                        </a>
                      </div>

                      <div className="detail-map detail-map--hotel">
                        <iframe
                          title={`Карта отеля: ${selectedInfoSection.hotelName}`}
                          src={buildHotelYandexMapUrl(tour)}
                          loading="lazy"
                          allowFullScreen
                        />
                      </div>
                    </div>

                    <div className="detail-hotel-layout">
                      <div className="detail-hotel-description">
                        <h4>Описание отеля</h4>
                        <div className="detail-rich-text">
                          {splitTextBlocks(selectedInfoSection.text).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>

                      <div className="detail-hotel-card">
                        <h4>Характеристики</h4>
                        <ul className="detail-include-panel__list">
                          {selectedInfoSection.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="detail-include-panel__note">
                      <strong>Важно:</strong>
                      <span>{selectedInfoSection.note}</span>
                    </div>
                  </>
                ) : (
                  <div className="detail-include-text-layout">
                    <div className="detail-include-panel__content detail-include-panel__content--wide">
                      <div className="detail-rich-text">
                        {splitTextBlocks(selectedInfoSection.text).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>

                      <ul className="detail-include-panel__list">
                        {selectedInfoSection.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>

                      <div className="detail-include-panel__note">
                        <strong>Важно:</strong>
                        <span>{selectedInfoSection.note}</span>
                      </div>
                    </div>

                    {selectedInfoSection.key === 'resort' && (
                      <div className="detail-resort-facts">
                        {selectedInfoSection.facts.map((fact) => (
                          <div className="detail-resort-fact" key={fact.label}>
                            <span>{fact.label}</span>
                            <strong>{fact.value}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )}
          </section>

          {tour.program_details && (
            <section className="detail-section">
              <div className="detail-section__head">
                <h2>Подробности программы</h2>
              </div>
              <div className="detail-section__content detail-text-block">
                {tour.program_details}
              </div>
            </section>
          )}

          <section className="detail-section">
            <div className="detail-section__head">
              <div>
                <h2>Локация тура</h2>
                <p className="site-muted">
                  Основное направление тура на Яндекс.Картах.
                </p>
              </div>
            </div>

            <div className="detail-map">
              <iframe
                title={`Карта тура ${tour.title}`}
                src={buildYandexMapUrl(tour)}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section__head detail-section__head--reviews">
              <div>
                <h2>Отзывы</h2>
                <p className="site-muted">
                  Средний рейтинг: <strong>{Number(tour.rating || 0).toFixed(1)}</strong> ·{' '}
                  {reviews.length} отзывов
                </p>
              </div>

              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => {
                  const token = localStorage.getItem('token');
                  if (!token) {
                    navigate('/login');
                    return;
                  }

                  setReviewError('');
                  setReviewSuccess('');
                  setShowReviewForm((prev) => !prev);
                }}
              >
                {showReviewForm ? 'Скрыть форму' : 'Оставить отзыв'}
              </button>
            </div>

            {reviewSuccess && (
              <div className="detail-alert detail-alert--success">{reviewSuccess}</div>
            )}

            {reviewError && (
              <div className="detail-alert detail-alert--error">{reviewError}</div>
            )}

            {showReviewForm && (
              <form className="detail-review-form" onSubmit={handleReviewSubmit}>
                <div className="catalog-field">
                  <label>Рейтинг</label>
                  <select
                    name="rating"
                    value={reviewFormData.rating}
                    onChange={handleReviewChange}
                  >
                    <option value="5">★★★★★ 5 звезд</option>
                    <option value="4">★★★★☆ 4 звезды</option>
                    <option value="3">★★★☆☆ 3 звезды</option>
                    <option value="2">★★☆☆☆ 2 звезды</option>
                    <option value="1">★☆☆☆☆ 1 звезда</option>
                  </select>
                </div>

                <div className="catalog-field">
                  <label>Комментарий</label>
                  <textarea
                    name="comment"
                    value={reviewFormData.comment}
                    onChange={handleReviewChange}
                    rows="5"
                    placeholder="Поделитесь впечатлениями о туре..."
                    className="detail-review-form__textarea"
                  />
                </div>

                <div className="detail-review-form__actions">
                  <button
                    type="submit"
                    className="site-button site-button--primary"
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? 'Отправка...' : 'Отправить отзыв'}
                  </button>
                </div>
              </form>
            )}

            {reviewsLoading ? (
              <div className="home-empty">Загрузка отзывов...</div>
            ) : reviews.length === 0 ? (
              <div className="home-empty">Пока нет отзывов. Будьте первым.</div>
            ) : (
              <div className="detail-reviews-list">
                {reviews.map((review) => {
                  const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));

                  return (
                    <article key={review.id} className="detail-review-card">
                      <div className="detail-review-card__top">
                        <div>
                          <h3 className="detail-review-card__name">
                            {review.user_first_name || 'Пользователь'}{' '}
                            {review.user_last_name ? `${review.user_last_name[0]}.` : ''}
                          </h3>
                          <div className="detail-review-card__rating">
                            {'★'.repeat(rating)}
                            {'☆'.repeat(5 - rating)}
                            <span>({rating})</span>
                          </div>
                        </div>

                        <span className="detail-review-card__date">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      <p className="detail-review-card__text">
                        {review.comment || 'Без комментария'}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar">
          <div className="detail-sidebar__card">
            <h3 className="detail-sidebar__title">Кратко о туре</h3>

            <div className="detail-sidebar__row">
              <span>Стоимость</span>
              <strong>{formatPrice(tour.price)}</strong>
            </div>

            <div className="detail-sidebar__row">
              <span>Направление</span>
              <strong>
                {tour.city}, {tour.country}
              </strong>
            </div>

            <div className="detail-sidebar__row">
              <span>Даты</span>
              <strong>
                {formatDate(tour.start_date)} — {formatDate(tour.end_date)}
              </strong>
            </div>

            <div className="detail-sidebar__row">
              <span>Свободно мест</span>
              <strong>{availableSeats} из {tour.max_people}</strong>
            </div>

            <div className="detail-sidebar__row">
              <span>Отзывы</span>
              <strong>{tour.review_count || reviews.length}</strong>
            </div>

            <button
              type="button"
              className="site-button site-button--primary detail-sidebar__button"
              onClick={handleBookTour}
              disabled={availableSeats <= 0}
            >
              {availableSeats > 0 ? 'Забронировать' : 'Мест нет'}
            </button>
          </div>

          {showBookingForm && (
            <div className="detail-sidebar__booking">
              <BookingForm
                tour={tour}
                onBookingSuccess={() => {
                  setShowBookingForm(false);
                  loadTour();
                }}
              />
            </div>
          )}
        </aside>
      </section>

    </div>
  );
};

export default TourDetailPage;
