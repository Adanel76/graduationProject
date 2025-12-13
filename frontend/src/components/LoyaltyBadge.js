import React from 'react';

const LoyaltyBadge = ({ level, points, nextLevelPoints }) => {
  const levelConfig = {
    bronze: { color: '#cd7f32', name: 'Бронза', minPoints: 0 },
    silver: { color: '#c0c0c0', name: 'Серебро', minPoints: 1000 },
    gold: { color: '#ffd700', name: 'Золото', minPoints: 5000 },
    platinum: { color: '#e5e4e2', name: 'Платина', minPoints: 10000 }
  };

  const currentConfig = levelConfig[level] || levelConfig.bronze;
  const progress = nextLevelPoints ? (points / nextLevelPoints) * 100 : 0;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '1.5rem',
      boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      marginBottom: '1rem'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: currentConfig.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: level === 'gold' ? '#000' : '#fff',
            fontWeight: 'bold'
          }}>
            {level === 'bronze' && '🥉'}
            {level === 'silver' && '🥈'}
            {level === 'gold' && '🥇'}
            {level === 'platinum' && '💎'}
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>
              Уровень: {currentConfig.name}
            </h3>
            <p style={{ margin: 0, color: '#7f8c8d', fontSize: '0.9rem' }}>
              {points} баллов
            </p>
          </div>
        </div>
        
        {nextLevelPoints && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f8c8d' }}>
              До следующего уровня:
            </p>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#3498db' }}>
              {nextLevelPoints - points} баллов
            </p>
          </div>
        )}
      </div>

      {nextLevelPoints && (
        <div style={{
          height: '8px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: currentConfig.color,
            width: `${Math.min(progress, 100)}%`,
            transition: 'width 0.3s ease'
          }}></div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginTop: '1rem',
        fontSize: '0.85rem'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '0.75rem',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', color: '#27ae60' }}>5%</div>
          <div style={{ color: '#7f8c8d' }}>Скидка на туры</div>
        </div>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '0.75rem',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', color: '#3498db' }}>2x</div>
          <div style={{ color: '#7f8c8d' }}>Баллы за бронирование</div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyBadge;
