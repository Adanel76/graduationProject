import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState({
    email_booking_confirmation: true,
    email_booking_updates: true,
    email_newsletter: false,
    email_promotions: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userResponse = await tourismAPI.getCurrentUser();
      setUser(userResponse.data);
      
      // В реальном приложении здесь будут загружаться настройки уведомлений из БД
      // Пока используем значения по умолчанию
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (notificationType) => {
    setNotifications(prev => ({
      ...prev,
      [notificationType]: !prev[notificationType]
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSuccess(false);
    
    try {
      // В реальном приложении здесь будет API для сохранения настроек
      // Пока симулируем сохранение
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
    } finally {
      setSaving(false);
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
        }}>Загрузка настроек...</div>
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
        <h1>Настройки уведомлений</h1>
        <button 
          onClick={() => navigate('/profile')}
          style={{
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Назад в профиль
        </button>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2>Email уведомления</h2>
        <p>Выберите, какие уведомления вы хотите получать на email:</p>
        
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid #eee',
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Подтверждение бронирования</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                Уведомления о новых бронированиях
              </p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
              <input
                type="checkbox"
                checked={notifications.email_booking_confirmation}
                onChange={() => handleNotificationChange('email_booking_confirmation')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: notifications.email_booking_confirmation ? '#27ae60' : '#ccc',
                transition: '.4s',
                borderRadius: '34px',
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '26px',
                  width: '26px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  transition: '.4s',
                  borderRadius: '50%',
                  transform: notifications.email_booking_confirmation ? 'translateX(26px)' : 'translateX(0)',
                }}></span>
              </span>
            </label>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid #eee',
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Обновления бронирований</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                Уведомления об изменении статуса бронирований
              </p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
              <input
                type="checkbox"
                checked={notifications.email_booking_updates}
                onChange={() => handleNotificationChange('email_booking_updates')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: notifications.email_booking_updates ? '#27ae60' : '#ccc',
                transition: '.4s',
                borderRadius: '34px',
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '26px',
                  width: '26px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  transition: '.4s',
                  borderRadius: '50%',
                  transform: notifications.email_booking_updates ? 'translateX(26px)' : 'translateX(0)',
                }}></span>
              </span>
            </label>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid #eee',
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Новости и статьи</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                Полезные статьи и новости из мира туризма
              </p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
              <input
                type="checkbox"
                checked={notifications.email_newsletter}
                onChange={() => handleNotificationChange('email_newsletter')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: notifications.email_newsletter ? '#27ae60' : '#ccc',
                transition: '.4s',
                borderRadius: '34px',
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '26px',
                  width: '26px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  transition: '.4s',
                  borderRadius: '50%',
                  transform: notifications.email_newsletter ? 'translateX(26px)' : 'translateX(0)',
                }}></span>
              </span>
            </label>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
          }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Специальные предложения</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                Персональные скидки и акции
              </p>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px' }}>
              <input
                type="checkbox"
                checked={notifications.email_promotions}
                onChange={() => handleNotificationChange('email_promotions')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: notifications.email_promotions ? '#27ae60' : '#ccc',
                transition: '.4s',
                borderRadius: '34px',
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '26px',
                  width: '26px',
                  left: '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  transition: '.4s',
                  borderRadius: '50%',
                  transform: notifications.email_promotions ? 'translateX(26px)' : 'translateX(0)',
                }}></span>
              </span>
            </label>
          </div>
        </div>
        
        {success && (
          <div style={{
            backgroundColor: '#27ae60',
            color: 'white',
            padding: '1rem',
            borderRadius: '5px',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>
            Настройки успешно сохранены!
          </div>
        )}
        
        <button 
          onClick={handleSaveSettings}
          disabled={saving}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '12px 30px',
            fontSize: '1rem',
            borderRadius: '5px',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
