import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import BookingForm from '../components/BookingForm';

const TourDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewFormData, setReviewFormData] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    loadTour();
    loadReviews();
  }, [id]);

  const loadTour = async () => {
    try {
      setLoading(true);
      const response = await tourismAPI.getTour(id);
      setTour(response.data);
    } catch (error) {
      console.error('Ошибка загрузки тура:', error);
      setError('Тур не найден');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await tourismAPI.getReviews();
      const tourReviews = response.data.filter(review => review.tour_id === parseInt(id));
      setReviews(tourReviews);
    } catch (error) {
      console.error('Ошибка загрузки отзывов:', error);
    }
  };

  const handleBookTour = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setShowBookingForm(true);
  };

  const handleReviewChange = (e) => {
    setReviewFormData({
      ...reviewFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const reviewData = {
        tour_id: parseInt(id),
        rating: parseInt(reviewFormData.rating),
        comment: reviewFormData.comment
      };
      
      await tourismAPI.createReview(reviewData);
      
      setReviewFormData({ rating: 5, comment: '' });
      setShowReviewForm(false);
      loadReviews();
      
    } catch (error) {
      console.error('Ошибка отправки отзыва:', error);
      alert('Ошибка при отправке отзыва');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Функция для получения изображения по стране
  const getCountryImage = (country) => {
    const countryImages = {
      'Франция': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'Япония': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'Италия': 'https://images.unsplash.com/photo-1552832230-c0197dd311b0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'США': 'https://images.unsplash.com/photo-1496581427952-7c1c5abcdd8f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'Индонезия': 'https://images.unsplash.com/photo-1570213847583-d557a180e5c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'ОАЭ': 'https://images.unsplash.com/photo-1594088053000-08b36a3c7dfa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'Великобритания': 'https://images.unsplash.com/photo-1513635269975-522017d98118?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'Россия': 'https://images.unsplash.com/photo-1570213847583-d557a180e5c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80',
      'default': 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400&q=80'
    };
    
    return countryImages[country] || countryImages['default'];
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Тур не найден</div>
      </div>
    );
  }

  // Определяем источник изображения для деталей тура
  const tourImageSrc = tour.image_data || getCountryImage(tour.country);

  return (
    <div style={styles.container}>
      <div style={styles.tourDetail}>
        <img 
          src={tourImageSrc} 
          alt={tour.title} 
          style={styles.image}
        />
        <div style={styles.content}>
          <h1 style={styles.title}>{tour.title}</h1>
          <p style={styles.description}>{tour.description}</p>
          
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <strong>Цена:</strong>
              <div style={styles.price}>{tour.price.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style={styles.infoCard}>
              <strong>Длительность:</strong>
              <div style={styles.duration}>{tour.duration} дней</div>
            </div>
            <div style={styles.infoCard}>
              <strong>Место:</strong>
              <div style={styles.location}>{tour.city}, {tour.country}</div>
            </div>
            <div style={styles.infoCard}>
              <strong>Даты:</strong>
              <div style={styles.dates}>
                {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
              </div>
            </div>
            <div style={styles.infoCard}>
              <strong>Максимум человек:</strong>
              <div style={styles.maxPeople}>{tour.max_people}</div>
            </div>
          </div>
          
          {tour.program && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '2rem',
            }}>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                borderBottom: '2px solid #3498db',
                paddingBottom: '0.5rem'
              }}>
                📋 Программа тура
              </h3>
              <div style={{
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                fontSize: '1rem'
              }}>
                {tour.program}
              </div>
            </div>
          )}


          <button 
            onClick={handleBookTour}
            style={styles.bookButton}
          >
            Забронировать тур
          </button>
          
          {showBookingForm && (
            <div style={styles.bookingSection}>
              <BookingForm 
                tour={tour}
                onBookingSuccess={() => {
                  setShowBookingForm(false);
                  alert('Тур успешно забронирован!');
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Отзывы */}
      <div style={{ marginTop: '3rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}>
          <h2>Отзывы ({reviews.length})</h2>
          <button 
            onClick={() => {
              const token = localStorage.getItem('token');
              if (!token) {
                navigate('/login');
                return;
              }
              setShowReviewForm(!showReviewForm);
            }}
            style={{
              backgroundColor: '#f39c12',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Оставить отзыв
          </button>
        </div>

        {/* Форма отзыва */}
        {showReviewForm && (
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '5px',
            marginBottom: '2rem',
          }}>
            <h3>Ваш отзыв</h3>
            <form onSubmit={handleReviewSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Рейтинг:
                </label>
                <select
                  name="rating"
                  value={reviewFormData.rating}
                  onChange={handleReviewChange}
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '1rem',
                  }}
                >
                  <option value="5">★★★★★ 5 звезд</option>
                  <option value="4">★★★★☆ 4 звезды</option>
                  <option value="3">★★★☆☆ 3 звезды</option>
                  <option value="2">★★☆☆☆ 2 звезды</option>
                  <option value="1">★☆☆☆☆ 1 звезда</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Комментарий:
                </label>
                <textarea
                  name="comment"
                  value={reviewFormData.comment}
                  onChange={handleReviewChange}
                  rows="4"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    fontSize: '1rem',
                    resize: 'vertical',
                  }}
                  placeholder="Ваш комментарий..."
                />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="submit"
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Отправить отзыв
                </button>
                <button 
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  style={{
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список отзывов */}
        <div>
          {reviews.length === 0 ? (
            <p>Пока нет отзывов. Будьте первым!</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {reviews.map(review => (
                <div key={review.id} style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '5px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold' }}>
                        {review.user_first_name} {review.user_last_name?.[0]}.
                      </span>
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
                    </div>
                    <span style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>
                    {review.comment || 'Без комментария'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  tourDetail: {
    backgroundColor: 'white',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
  },
  image: {
    width: '100%',
    height: '400px',
    objectFit: 'cover',
  },
  content: {
    padding: '2rem',
  },
  title: {
    color: '#2c3e50',
    marginBottom: '1rem',
  },
  description: {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    marginBottom: '2rem',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  infoCard: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '5px',
  },
  price: {
    fontSize: '1.5rem',
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  duration: {
    fontSize: '1.2rem',
  },
  location: {
    fontSize: '1.2rem',
  },
  dates: {
    fontSize: '1rem',
  },
  maxPeople: {
    fontSize: '1.2rem',
  },
  bookButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    fontSize: '1.2rem',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  bookingSection: {
    marginTop: '2rem',
    padding: '1rem',
    border: '1px solid #ddd',
    borderRadius: '5px',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
  },
  error: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#e74c3c',
  },
};

export default TourDetailPage;
