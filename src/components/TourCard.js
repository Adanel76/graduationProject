import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FALLBACK_TOUR_IMAGE, getTourCardImageSrc } from '../services/api';
import { useFavorites } from './FavoritesContext';

const TourCard = ({ tour }) => {
  const navigate = useNavigate();
  const { favoriteIds, addToFavorites, removeFromFavorites } = useFavorites();

  const isFavorite = useMemo(() => {
    return favoriteIds?.has(Number(tour.id));
  }, [favoriteIds, tour.id]);

  const imageSrc = useMemo(() => getTourCardImageSrc(tour), [tour]);

  const formatPrice = (value) => {
    return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
  };

  const handleOpen = () => {
    navigate(`/tours/${tour.id}`);
  };

  const handleFavoriteClick = async (e) => {
    e.stopPropagation();

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      if (isFavorite) {
        await removeFromFavorites(tour.id);
      } else {
        await addToFavorites(tour.id, tour);
      }
    } catch (error) {
      console.error('Ошибка работы с избранным:', error);
    }
  };

  return (
    <article className="tour-card-v2 hover-lift" onClick={handleOpen}>
      <div className="tour-card-v2__media image-zoom-wrap">
        <img
          src={imageSrc}
          alt={tour.title}
          className="tour-card-v2__image image-zoom"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_TOUR_IMAGE) {
              e.currentTarget.src = FALLBACK_TOUR_IMAGE;
            }
          }}
        />

        <button
          type="button"
          className={`tour-card-v2__favorite ${isFavorite ? 'tour-card-v2__favorite--active' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>

      <div className="tour-card-v2__content">
        <div className="tour-card-v2__top">
          <div>
            <h3 className="tour-card-v2__title">{tour.title}</h3>
            <p className="tour-card-v2__location">
              {tour.city}, {tour.country}
            </p>
          </div>

          <div className="tour-card-v2__price">{formatPrice(tour.price)}</div>
        </div>

        <p className="tour-card-v2__description">
          {tour.description || 'Подробное описание доступно на странице тура.'}
        </p>

        <div className="tour-card-v2__meta">
          <span className="ui-chip">{tour.duration} дн.</span>
          <span className="ui-chip">★ {Number(tour.rating || 0).toFixed(1)}</span>
          <span className="ui-chip">{tour.review_count || 0} отзывов</span>
          <span className="ui-chip">мест: {tour.available_seats ?? tour.max_people}</span>
        </div>
      </div>
    </article>
  );
};

export default React.memo(TourCard);
