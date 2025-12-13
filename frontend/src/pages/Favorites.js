import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../components/FavoritesContext';
import TourCard from '../components/TourCard';
import AnimatedSection from '../components/AnimatedSection';

const Favorites = () => {
  const { favorites, clearAllFavorites, favoritesCount, maxFavorites } = useFavorites();
  const navigate = useNavigate();

  const handleClearAll = () => {
    if (window.confirm(`Вы уверены, что хотите очистить все избранные туры (${favoritesCount})?`)) {
      clearAllFavorites();
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <AnimatedSection>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <h1>Избранные туры</h1>
            <p style={{ color: '#7f8c8d', margin: '0.5rem 0 0 0' }}>
              {favoritesCount} из {maxFavorites} возможных
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {favoritesCount > 0 && (
              <button 
                onClick={handleClearAll}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                Очистить все
              </button>
            )}
            <button 
              onClick={() => navigate('/tours')}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Найти больше туров
            </button>
          </div>
        </div>

        {favoritesCount > 0 && (
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            border: '1px solid #eee'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>Прогресс:</span>
                <span style={{ marginLeft: '0.5rem' }}>
                  {favoritesCount} из {maxFavorites}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                {Math.round((favoritesCount / maxFavorites) * 100)}% заполнено
              </div>
            </div>
            <div style={{
              height: '8px',
              backgroundColor: '#ecf0f1',
              borderRadius: '4px',
              marginTop: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: favoritesCount > maxFavorites * 0.8 ? '#e74c3c' : 
                               favoritesCount > maxFavorites * 0.5 ? '#f39c12' : '#27ae60',
                width: `${(favoritesCount / maxFavorites) * 100}%`,
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
        )}

        {favorites.length === 0 ? (
          <AnimatedSection>
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: 'white',
              borderRadius: '10px',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '4rem', margin: '1rem 0' }}>💔</div>
              <h3>У вас пока нет избранных туров</h3>
              <p style={{ color: '#7f8c8d', marginBottom: '2rem' }}>
                Добавляйте туры в избранное, чтобы быстро находить их позже
              </p>
              <button 
                onClick={() => navigate('/tours')}
                style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Посмотреть туры
              </button>
            </div>
          </AnimatedSection>
        ) : (
          <AnimatedSection>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
            }}>
              {favorites.map(tour => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
            
            {favoritesCount >= maxFavorites && (
              <div style={{
                textAlign: 'center',
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '5px',
                color: '#856404'
              }}>
                <strong>Достигнут лимит избранных туров!</strong>
                <br />
                Очистите часть избранных туров или удалите ненужные, чтобы добавить новые.
              </div>
            )}
          </AnimatedSection>
        )}
      </AnimatedSection>
    </div>
  );
};

export default Favorites;
