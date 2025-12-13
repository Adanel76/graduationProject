import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { getLoginHistory, formatLoginDate, getRelativeTime, clearLoginHistory } from '../utils/loginHistory';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    phone: ''
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    // Триггерим событие обновления авторизации
    window.dispatchEvent(new Event('authChange'));
    navigate('/login');
  };


  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    if (user) {
      setEditFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone
      });
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Получаем информацию о пользователе
      try {
        const userResponse = await tourismAPI.getCurrentUser();
        setUser(userResponse.data);
      } catch (userError) {
        console.error('Ошибка загрузки пользователя:', userError);
        // Если не можем получить данные пользователя, перенаправляем на логин
        handleLogout();
        return;
      }
      
      // Получаем бронирования пользователя
      try {
        const bookingsResponse = await tourismAPI.getBookings();
        setBookings(bookingsResponse.data || []);
      } catch (bookingsError) {
        console.error('Ошибка загрузки бронирований:', bookingsError);
        setBookings([]); // Пустой массив если ошибка
      }
      
    } catch (error) {
      console.error('Общая ошибка загрузки профиля:', error);
      setError('Ошибка загрузки данных профиля');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Ожидание';
      case 'confirmed': return 'Подтверждено';
      case 'cancelled': return 'Отменено';
      default: return status || 'Неизвестно';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'confirmed': return '#27ae60';
      case 'cancelled': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await tourismAPI.updateUser(user.id, editFormData);
      // Обновляем данные пользователя
      const response = await tourismAPI.getCurrentUser();
      setUser(response.data);
      setIsEditing(false);
      alert('Профиль успешно обновлен!');
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      alert('Ошибка при обновлении профиля');
    }
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
        }}>Загрузка профиля...</div>
      </div>
    );
  }

  if (error) {
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
          color: '#e74c3c',
        }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: '2rem',
        color: '#2c3e50',
      }}>Мой профиль</h1>
      
      {user && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{ color: '#2c3e50' }}>Личная информация</h2>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                style={{
                  backgroundColor: '#f39c12',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Редактировать
              </button>
            )}
          </div>
          
          {isEditing ? (
            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Email:
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      backgroundColor: '#f8f9fa'
                    }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Имя:
                    </label>
                    <input
                      type="text"
                      value={editFormData.first_name}
                      onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Фамилия:
                    </label>
                    <input
                      type="text"
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Телефон:
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                    }}
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
                    Сохранить
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditFormData({
                        first_name: user.first_name,
                        last_name: user.last_name,
                        phone: user.phone
                      });
                    }}
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
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>📧 Email:</strong> 
                <span>{user.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>👤 Имя:</strong> 
                <span>{user.first_name} {user.last_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>📱 Телефон:</strong> 
                <span>{user.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>📅 Дата регистрации:</strong> 
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>🛡️ Статус:</strong> 
                <span style={{
                  backgroundColor: user.is_verified ? '#27ae60' : '#f39c12',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.8rem'
                }}>
                  {user.is_verified ? 'Подтвержден' : 'Не подтвержден'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Статистика пользователя */}
      {user && !isEditing && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ 
            color: '#2c3e50', 
            marginBottom: '1rem',
            borderBottom: '2px solid #3498db',
            paddingBottom: '0.5rem'
          }}>📊 Статистика</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '2rem', color: '#3498db', fontWeight: 'bold' }}>
                {bookings.length}
              </div>
              <div style={{ color: '#666' }}>Бронирований</div>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '2rem', color: '#27ae60', fontWeight: 'bold' }}>
                {bookings.filter(b => b.status === 'confirmed').length}
              </div>
              <div style={{ color: '#666' }}>Подтверждено</div>
            </div>
            
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '2rem', color: '#f39c12', fontWeight: 'bold' }}>
                {bookings.filter(b => b.status === 'pending').length}
              </div>
              <div style={{ color: '#666' }}>В ожидании</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Бронирования */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{ 
            color: '#2c3e50',
            borderBottom: '2px solid #3498db',
            paddingBottom: '0.5rem'
          }}>🎫 Мои бронирования</h2>
          <span style={{ 
            backgroundColor: '#3498db', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '15px',
            fontSize: '0.9rem'
          }}>
            Всего: {bookings.length}
          </span>
        </div>
        
        {bookings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#7f8c8d'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
            <h3>У вас пока нет бронирований</h3>
            <p>Начните планировать свое следующее путешествие!</p>
            <button 
              onClick={() => navigate('/tours')}
              style={{
                marginTop: '1rem',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Посмотреть туры
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem',
          }}>
            {bookings.map(booking => (
              <div key={booking.id} style={{
                border: '1px solid #eee',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: '#fafafa',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => e.target.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)'}
              onMouseOut={(e) => e.target.style.boxShadow = 'none'}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h3 style={{ 
                      margin: 0, 
                      color: '#2c3e50',
                      fontSize: '1.2rem'
                    }}>
                      Бронирование #{booking.id}
                    </h3>
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      color: '#7f8c8d',
                      fontSize: '0.9rem'
                    }}>
                      Дата: {formatDate(booking.booking_date)}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '15px',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    backgroundColor: getStatusColor(booking.status)
                  }}>
                    {getStatusText(booking.status)}
                  </span>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <strong>👥 Количество человек:</strong>
                    <div>{booking.people_count}</div>
                  </div>
                  <div>
                    <strong>💰 Статус:</strong>
                    <div>{getStatusText(booking.status)}</div>
                  </div>
                </div>
                
                {booking.status === 'pending' && (
                  <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '5px',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    color: '#856404'
                  }}>
                    ⏳ Ваше бронирование ожидает подтверждения. Наш менеджер свяжется с вами в ближайшее время.
                  </div>
                )}
                
                {booking.status === 'confirmed' && (
                  <div style={{
                    backgroundColor: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '5px',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    color: '#155724'
                  }}>
                    ✅ Ваше бронирование подтверждено! Ждем вас в назначенную дату.
                  </div>
                )}
                
                {booking.status === 'cancelled' && (
                  <div style={{
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '5px',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    color: '#721c24'
                  }}>
                    ❌ Бронирование отменено.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* История входов */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{ 
            color: '#2c3e50',
            borderBottom: '2px solid #3498db',
            paddingBottom: '0.5rem'
          }}>🕐 История входов</h2>
          <button 
            onClick={() => {
              if (window.confirm('Вы уверены, что хотите очистить историю входов?')) {
                clearLoginHistory();
                // Перезагружаем страницу или обновляем состояние
                window.location.reload();
              }
            }}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Очистить
          </button>
        </div>
        
        {getLoginHistory().length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#7f8c8d'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕐</div>
            <p>История входов пуста</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '0.75rem',
          }}>
            {getLoginHistory().slice(0, 5).map((login, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '5px',
                border: '1px solid #eee'
              }}>
                <div>
                  <div style={{ 
                    fontWeight: 'bold',
                    color: '#2c3e50'
                  }}>
                    {login.name || login.email}
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem',
                    color: '#7f8c8d'
                  }}>
                    {login.email}
                  </div>
                </div>
                <div style={{ 
                  textAlign: 'right',
                  fontSize: '0.85rem',
                  color: '#666'
                }}>
                  <div>{formatLoginDate(login.timestamp)}</div>
                  <div>{getRelativeTime(login.timestamp)}</div>
                </div>
              </div>
            ))}
            {getLoginHistory().length > 5 && (
              <div style={{
                textAlign: 'center',
                padding: '0.5rem',
                color: '#7f8c8d',
                fontSize: '0.9rem'
              }}>
                Показаны последние 5 входов из {getLoginHistory().length}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Кнопки действий */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={() => navigate('/notifications')}
          style={{
            backgroundColor: '#9b59b6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ⚙️ Настройки уведомлений
        </button>
        
        <button 
          onClick={handleLogout}
          style={{
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          🚪 Выйти
        </button>
      </div>
    </div>
  );
};

export default Profile;
