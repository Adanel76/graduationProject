import React, { useState } from 'react';

const MediaReview = ({ review }) => {
  const [showAllImages, setShowAllImages] = useState(false);

  const images = review.media?.filter(item => item.type === 'image') || [];
  const videos = review.media?.filter(item => item.type === 'video') || [];

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '1rem'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#3498db',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {review.user_first_name?.[0] || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {review.user_first_name} {review.user_last_name?.[0] || ''}.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {[...Array(5)].map((_, i) => (
                <span 
                  key={i} 
                  style={{ 
                    color: i < review.rating ? '#f39c12' : '#ddd',
                    fontSize: '1rem'
                  }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
        <span style={{ 
          color: '#7f8c8d', 
          fontSize: '0.85rem' 
        }}>
          {new Date(review.created_at).toLocaleDateString('ru-RU')}
        </span>
      </div>

      {review.comment && (
        <p style={{ 
          margin: '0 0 1rem 0',
          lineHeight: '1.5'
        }}>
          {review.comment}
        </p>
      )}

      {/* Медиа контент */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: showAllImages ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(3, 1fr)',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          {images.slice(0, showAllImages ? images.length : 3).map((image, index) => (
            <div key={index} style={{
              position: 'relative',
              height: '100px',
              overflow: 'hidden',
              borderRadius: '4px'
            }}>
              <img 
                src={image.url} 
                alt="Review media"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          ))}
          {!showAllImages && images.length > 3 && (
            <div 
              onClick={() => setShowAllImages(true)}
              style={{
                backgroundColor: 'rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              +{images.length - 3} фото
            </div>
          )}
        </div>
      )}

      {/* Ачивки пользователя */}
      {review.user_achievements && review.user_achievements.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '1rem'
        }}>
          {review.user_achievements.slice(0, 3).map((achievement, index) => (
            <span key={index} style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              🏆 {achievement.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaReview;
