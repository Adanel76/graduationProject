import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useFavorites } from '../components/FavoritesContext';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=80';

const Favorites = () => {
  const navigate = useNavigate();
  const { favorites, loading, removeFromFavorites } = useFavorites();

  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [favorites]);

  const formatMoney = (value) => {
    return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
  };

  const getImageSrc = (tour) => {
    if (tour?.image_data) {
      if (String(tour.image_data).startsWith('data:')) {
        return tour.image_data;
      }

      return `data:${tour.image_type || 'image/jpeg'};base64,${tour.image_data}`;
    }

    if (tour?.image_url) {
      return tour.image_url;
    }

    if (tour?.id) {
      return tourismAPI.getTourImageUrl(tour.id);
    }

    return FALLBACK_IMAGE;
  };

  const handleOpenTour = (tourId) => {
    navigate(`/tours/${tourId}`);
  };

  const handleRemove = async (e, tourId) => {
    e.stopPropagation();

    try {
      await removeFromFavorites(tourId);
    } catch (error) {
      console.error('Ошибка удаления из избранного:', error);
      alert('Не удалось удалить тур из избранного');
    }
  };

  if (loading) {
    return (
      <div className="favorites-page">
        <div className="page-shell">
          <div className="home-empty">Загрузка избранного...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="page-shell">
        <section className="favorites-hero">
          <div>
            <span className="home-hero__eyebrow">Saved / Personal collection</span>
            <h1 className="favorites-hero__title">Избранные туры</h1>
            <p className="favorites-hero__text">
              Здесь собраны туры, которые вы отметили для быстрого возврата,
              сравнения и дальнейшего бронирования.
            </p>
          </div>

          <div className="favorites-hero__stats">
            <div className="favorites-chip">
              <span>Сохранено</span>
              <strong>{sortedFavorites.length}</strong>
            </div>
          </div>
        </section>

        {sortedFavorites.length === 0 ? (
          <section className="favorites-empty">
            <div className="favorites-empty__inner">
              <span className="favorites-empty__icon">♡</span>
              <h2>В избранном пока пусто</h2>
              <p>
                Сохраняйте понравившиеся туры, чтобы быстро вернуться к ним позже.
              </p>
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={() => navigate('/tours')}
              >
                Перейти к турам
              </button>
            </div>
          </section>
        ) : (
          <section className="favorites-grid">
            {sortedFavorites.map((tour) => {
              const imageSrc = getImageSrc(tour);

              return (
                <article
                  key={tour.id}
                  className="favorite-card"
                  onClick={() => handleOpenTour(tour.id)}
                >
                  <div className="favorite-card__image-wrap">
                    <img
                      src={imageSrc}
                      alt={tour.title}
                      className="favorite-card__image"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />

                    <button
                      type="button"
                      className="favorite-card__remove"
                      onClick={(e) => handleRemove(e, tour.id)}
                      title="Убрать из избранного"
                    >
                      ♥
                    </button>
                  </div>

                  <div className="favorite-card__content">
                    <div className="favorite-card__top">
                      <div>
                        <h2 className="favorite-card__title">{tour.title}</h2>
                        <p className="favorite-card__location">
                          {tour.city}, {tour.country}
                        </p>
                      </div>

                      <div className="favorite-card__price">
                        {formatMoney(tour.price)}
                      </div>
                    </div>

                    <p className="favorite-card__description">
                      {tour.description || 'Описание тура будет доступно на детальной странице.'}
                    </p>

                    <div className="favorite-card__meta">
                      <span>{tour.duration} дн.</span>
                      <span>до {tour.max_people} чел.</span>
                      <span>★ {Number(tour.rating || 0).toFixed(1)}</span>
                      <span>{tour.review_count || 0} отзывов</span>
                    </div>

                    <div className="favorite-card__actions">
                      <button
                        type="button"
                        className="site-button site-button--primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTour(tour.id);
                        }}
                      >
                        Открыть тур
                      </button>

                      <button
                        type="button"
                        className="site-button site-button--secondary"
                        onClick={(e) => handleRemove(e, tour.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
};

export default Favorites;