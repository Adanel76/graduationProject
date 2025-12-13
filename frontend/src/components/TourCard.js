import React from 'react';
import { Link } from 'react-router-dom';
import { useFavorites } from './FavoritesContext';

const TourCard = ({ tour }) => {
  const { isFavorite, addToFavorites, removeFromFavorites, favoritesCount, maxFavorites } = useFavorites();
  
  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Дата не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // Функция для форматирования превью программы
  const formatProgramPreview = (program) => {
    if (!program) return '';
    // Берем первые 100 символов программы
    return program.substring(0, 100) + (program.length > 100 ? '...' : '');
  };

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isFavorite(tour.id)) {
      removeFromFavorites(tour.id);
    } else {
      // Проверяем лимит перед добавлением
      if (favoritesCount >= maxFavorites) {
        alert(`Максимальное количество избранных туров: ${maxFavorites}`);
        return;
      }
      addToFavorites(tour);
    }
  };

  // Функция для получения placeholder изображения по стране
  const getCountryImage = (country) => {
    const countryImages = {
      'Франция': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'Япония': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'Италия': 'https://images.unsplash.com/photo-1552832230-c0197dd311b0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'США': 'https://images.unsplash.com/photo-1496581427952-7c1c5abcdd8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'Индонезия': 'https://images.unsplash.com/photo-1570213847583-d557a180e5c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'ОАЭ': 'https://images.unsplash.com/photo-1594088053000-08b36a3c7dfa?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'Великобритания': 'https://images.unsplash.com/photo-1513635269975-522017d98118?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'Россия': 'https://images.unsplash.com/photo-1570213847583-d557a180e5c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80',
      'default': 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=250&q=80'
    };
    
    return countryImages[country] || countryImages['default'];
  };

  // Проверки на существование данных
  const tourTitle = tour.title || 'Без названия';
  const tourDescription = tour.description || 'Описание отсутствует';
  const tourCity = tour.city || 'Город не указан';
  const tourCountry = tour.country || 'Страна не указана';
  const tourDuration = tour.duration || 0;
  const tourPrice = tour.price || 0;
  const tourStartDate = tour.start_date;

  // Определяем источник изображения
  const imageSrc = tour.image_data || getCountryImage(tourCountry);

  return (
    <div 
      className="tour-card"
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Кнопка избранного */}
      <button 
        onClick={toggleFavorite}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          cursor: 'pointer',
          fontSize: '16px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s',
          // Добавляем визуальную индикацию при достижении лимита
          ...(favoritesCount >= maxFavorites && !isFavorite(tour.id) ? {
            opacity: 0.5,
            cursor: 'not-allowed'
          } : {})
        }}
        disabled={favoritesCount >= maxFavorites && !isFavorite(tour.id)}
        title={favoritesCount >= maxFavorites && !isFavorite(tour.id) ? 
          `Достигнут лимит избранных (${maxFavorites})` : 
          isFavorite(tour.id) ? 'Удалить из избранного' : 'Добавить в избранное'}
        onMouseOver={(e) => {
          if (!(favoritesCount >= maxFavorites && !isFavorite(tour.id))) {
            e.target.style.transform = 'scale(1.1)';
          }
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
      >
        {isFavorite(tour.id) ? '❤️' : '🤍'}
      </button>
      
      {/* Контейнер для изображения */}
      <div style={{
        width: '100%',
        height: '200px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <img 
          src={imageSrc} 
          alt={tourTitle} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transition: 'transform 0.3s ease',
          }}
        />
      </div>
      
      <div style={{
        padding: '1.5rem',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h3 style={{
          marginBottom: '0.75rem',
          color: '#2c3e50',
          fontSize: '1.25rem',
          fontWeight: '600',
          lineHeight: '1.3',
        }}>
          {tourTitle}
        </h3>
        
        <p style={{
          marginBottom: '1rem',
          color: '#666',
          fontSize: '0.95rem',
          lineHeight: '1.5',
          flex: 1,
        }}>
          {tourDescription.substring(0, 120)}...
        </p>
        
        {/* Программа тура - кратко */}
        {tour.program && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: '#7f8c8d',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span>📋</span>
              <span>{formatProgramPreview(tour.program)}</span>
            </div>
          </div>
        )}
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          marginBottom: '1.25rem',
          fontSize: '0.9rem',
          color: '#7f8c8d',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📍</span>
            <span>{tourCity}, {tourCountry}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅</span>
            <span>{tourDuration} дней</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📆</span>
            <span>{formatDate(tourStartDate)}</span>
          </div>
        </div>
        
        <div style={{
          fontSize: '1.6rem',
          fontWeight: '700',
          color: '#e74c3c',
          marginBottom: '1.25rem',
        }}>
          {tourPrice.toLocaleString('ru-RU')} ₽
        </div>
        
        <Link 
          to={`/tours/${tour.id}`} 
          style={{
            display: 'block',
            backgroundColor: '#3498db',
            color: 'white',
            padding: '12px 20px',
            textDecoration: 'none',
            borderRadius: '6px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            fontWeight: '600',
            marginTop: 'auto',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#2980b9';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#3498db';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          Подробнее
        </Link>
      </div>
    </div>
  );
};

export default TourCard;
