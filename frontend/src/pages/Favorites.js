import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../components/FavoritesContext';
import TourCard from '../components/TourCard';

const Favorites = () => {
  const { favorites } = useFavorites();
  const navigate = useNavigate();

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1>Избранные туры</h1>
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

      {favorites.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h3>У вас пока нет избранных туров</h3>
          <p>Добавляйте туры в избранное, чтобы быстро находить их позже</p>
          <div style={{ fontSize: '4rem', margin: '1rem 0' }}>💔</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
        }}>
          {favorites.map(tour => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
