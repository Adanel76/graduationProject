import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const AdminReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    checkAdminAccess();
    loadReviews();
    loadTours();
  }, []);

  const checkAdminAccess = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
      navigate('/login');
    }
  };

  const loadReviews = async () => {
    try {
      const response = await tourismAPI.getReviews();
      setReviews(response.data);
    } catch (error) {
      console.error('Ошибка загрузки отзывов:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTours = async () => {
    try {
      const response = await tourismAPI.getTours();
      setTours(response.data);
    } catch (error) {
      console.error('Ошибка загрузки туров:', error);
    }
  };

  const getTourTitle = (tourId) => {
    const tour = tours.find(t => t.id === tourId);
    return tour ? tour.title : 'Не найден';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const deleteReview = async (reviewId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот отзыв?')) {
      try {
        await tourismAPI.deleteReview(reviewId);
        loadReviews();
      } catch (error) {
        console.error('Ошибка удаления отзыва:', error);
        alert('Ошибка при удалении отзыва');
      }
    }
  };

  // Фильтрация отзывов по рейтингу
  const filteredReviews = reviews.filter(review => {
    if (filter === 'all') return true;
    return review.rating.toString() === filter;
  });

  // Группировка по рейтингу для статистики
  const ratingStats = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          fontSize: '1.2rem',
        }}>Загрузка отзывов...</div>
      </div>
    );
  }

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
        <h1>Управление отзывами</h1>
        <button 
          onClick={() => navigate('/admin')}
          style={{
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '1rem',
          }}
        >
          Назад
        </button>
      </div>

      {/* Статистика */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h3 style={{ marginBottom: '1rem' }}>Статистика отзывов</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
        }}>
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '5px',
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#3498db' }}>Всего</h4>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{reviews.length}</p>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '5px',
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f39c12' }}>Средний рейтинг</h4>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{averageRating}</p>
          </div>
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Распределение по рейтингу:</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[5, 4, 3, 2, 1].map(rating => (
              <div key={rating} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#ecf0f1',
                borderRadius: '3px',
              }}>
                <span style={{ fontWeight: 'bold' }}>{rating}★</span>
                <span>({ratingStats[rating]})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h3 style={{ marginBottom: '1rem' }}>Фильтры</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setFilter('all')}
            style={{
              backgroundColor: filter === 'all' ? '#3498db' : '#ecf0f1',
              color: filter === 'all' ? 'white' : '#333',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Все ({reviews.length})
          </button>
          {[5, 4, 3, 2, 1].map(rating => (
            <button 
              key={rating}
              onClick={() => setFilter(rating.toString())}
              style={{
                backgroundColor: filter === rating.toString() ? '#f39c12' : '#ecf0f1',
                color: filter === rating.toString() ? 'white' : '#333',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              {rating}★ ({ratingStats[rating]})
            </button>
          ))}
        </div>
      </div>

      {/* Таблица отзывов */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2>Список отзывов</h2>
        
        {filteredReviews.length === 0 ? (
          <p>Нет отзывов для отображения</p>
        ) : (
          <div style={{
            overflowX: 'auto',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Тур</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Рейтинг</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Комментарий</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Дата</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map(review => (
                  <tr key={review.id}>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{review.id}</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {getTourTitle(review.tour_id)}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {[...Array(5)].map((_, i) => (
                          <span 
                            key={i} 
                            style={{ 
                              color: i < review.rating ? '#f39c12' : '#ddd',
                              fontSize: '1.2rem'
                            }}
                          >
                            ★
                          </span>
                        ))}
                        <span>({review.rating})</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {review.comment || 'Без комментария'}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {formatDate(review.created_at)}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      <button 
                        onClick={() => deleteReview(review.id)}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviews;
