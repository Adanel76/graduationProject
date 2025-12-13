import React, { useState, useEffect } from 'react';
import { tourismAPI } from '../services/api';
import TourCard from './TourCard';
import AnimatedSection from './AnimatedSection';

const TourRecommendations = ({ userId }) => {
  const [recommendedTours, setRecommendedTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, [userId]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      // В реальном приложении здесь будет API для получения рекомендаций
      const response = await tourismAPI.get('/tours/recommendations');
      setRecommendedTours(response.data.slice(0, 4)); // Показываем первые 4 рекомендации
    } catch (error) {
      console.error('Ошибка загрузки рекомендаций:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || recommendedTours.length === 0) return null;

  return (
    <AnimatedSection>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{
          color: '#2c3e50',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎯 Рекомендуем для вас
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {recommendedTours.map(tour => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
        
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem'
        }}>
          <button style={{
            backgroundColor: 'transparent',
            color: '#3498db',
            border: '1px solid #3498db',
            padding: '8px 16px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}>
            Смотреть все рекомендации
          </button>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default TourRecommendations;
