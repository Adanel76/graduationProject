import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAdminAccess();
    loadAdminStats();
    loadActivityStats();
  }, []);

  const checkAdminAccess = async () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
      navigate('/login');
      return;
    }

    try {
      const userResponse = await tourismAPI.getCurrentUser();
      setUser(userResponse.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      navigate('/login');
    }
  };

  const loadAdminStats = async () => {
    try {
      const statsResponse = await tourismAPI.get('/users/stats');
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setError('Ошибка загрузки статистики');
    }
  };

  const loadActivityStats = async () => {
    try {
      const activityResponse = await tourismAPI.get('/users/activity-stats');
      setActivityStats(activityResponse.data);
    } catch (error) {
      console.error('Ошибка загрузки активности:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

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
        }}>Загрузка панели администратора...</div>
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
        <h1>Панель администратора</h1>
        <button 
          onClick={handleLogout}
          style={{
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Выйти
        </button>
      </div>

      {user && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Добро пожаловать, {user.first_name} {user.last_name}!</h2>
          <p>Роль: Администратор</p>
        </div>
      )}

      {/* Статистика */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {stats && (
          <>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '1.5rem',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#3498db', marginBottom: '0.5rem' }}>Пользователи</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats.users.total}</p>
              <p style={{ fontSize: '0.9rem', margin: '0.5rem 0 0 0', color: '#27ae60' }}>
                Подтверждено: {stats.users.verified}
              </p>
            </div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '1.5rem',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#9b59b6', marginBottom: '0.5rem' }}>Туры</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats.tours.total}</p>
            </div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '1.5rem',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>Бронирования</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats.bookings.total}</p>
              <p style={{ fontSize: '0.9rem', margin: '0.5rem 0 0 0', color: '#27ae60' }}>
                Подтверждено: {stats.bookings.confirmed}
              </p>
            </div>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '1.5rem',
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>Отзывы</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats.reviews.total}</p>
              <p style={{ fontSize: '0.9rem', margin: '0.5rem 0 0 0', color: '#f39c12' }}>
                Средний рейтинг: {stats.reviews.average_rating.toFixed(1)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Графики активности */}
      {activityStats && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Активность за последние 30 дней</h2>
          
          {/* График регистраций */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>Регистрации пользователей</h3>
            <div style={{
              height: '200px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              padding: '10px 0',
              border: '1px solid #eee',
              borderRadius: '5px',
            }}>
              {activityStats.registrations.map((item, index) => {
                const maxCount = Math.max(...activityStats.registrations.map(r => r.count));
                const height = maxCount > 0 ? (item.count / maxCount) * 180 : 0;
                return (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      height: `${height}px`,
                      backgroundColor: '#3498db',
                      minWidth: '10px',
                      position: 'relative',
                    }}
                    title={`${item.date}: ${item.count} регистраций`}
                  >
                    <div style={{
                      position: 'absolute',
                      bottom: '-20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {new Date(item.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* График бронирований */}
          <div>
            <h3>Бронирования</h3>
            <div style={{
              height: '200px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              padding: '10px 0',
              border: '1px solid #eee',
              borderRadius: '5px',
            }}>
              {activityStats.bookings.map((item, index) => {
                const maxCount = Math.max(...activityStats.bookings.map(b => b.count));
                const height = maxCount > 0 ? (item.count / maxCount) * 180 : 0;
                return (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      height: `${height}px`,
                      backgroundColor: '#27ae60',
                      minWidth: '10px',
                      position: 'relative',
                    }}
                    title={`${item.date}: ${item.count} бронирований`}
                  >
                    <div style={{
                      position: 'absolute',
                      bottom: '-20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '10px',
                      whiteSpace: 'nowrap',
                    }}>
                      {new Date(item.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Быстрые действия */}
        <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '2rem',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
        <h2>Экспорт отчетов</h2>
        <button 
            onClick={() => navigate('/admin/reports')}
            style={{
            backgroundColor: '#9b59b6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '1rem',
            }}
        >
            Экспорт данных
        </button>
        </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Управление турами</h2>
          <button 
            onClick={() => navigate('/admin/tours')}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '1rem',
            }}
          >
            Управление турами
          </button>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Управление бронированиями</h2>
          <button 
            onClick={() => navigate('/admin/bookings')}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '1rem',
            }}
          >
            Управление бронированиями
          </button>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Управление отзывами</h2>
          <button 
            onClick={() => navigate('/admin/reviews')}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '1rem',
            }}
          >
            Управление отзывами
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
