import React, { useState, useEffect } from 'react';
import { tourismAPI } from '../services/api';

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      // В реальном приложении здесь будет API для получения уведомлений
      // Пока симулируем
      const mockNotifications = [
        {
          id: 1,
          type: 'new_booking',
          message: 'Новое бронирование: Тур в Париж',
          timestamp: new Date(),
          read: false
        },
        {
          id: 2,
          type: 'new_review',
          message: 'Новый отзыв: 5 звезд для тура в Токио',
          timestamp: new Date(Date.now() - 3600000),
          read: false
        },
        {
          id: 3,
          type: 'user_registered',
          message: 'Новый пользователь зарегистрирован',
          timestamp: new Date(Date.now() - 7200000),
          read: true
        }
      ];
      
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => prev - 1);
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
    }}>
      {unreadCount > 0 && (
        <div style={{
          backgroundColor: '#e74c3c',
          color: 'white',
          borderRadius: '50%',
          width: '25px',
          height: '25px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          position: 'absolute',
          top: '-5px',
          right: '-5px',
        }}>
          {unreadCount}
        </div>
      )}
      
      <button style={{
        backgroundColor: '#34495e',
        color: 'white',
        border: 'none',
        padding: '10px 15px',
        borderRadius: '5px',
        cursor: 'pointer',
      }}>
        🔔 Уведомления
      </button>
    </div>
  );
};

export default AdminNotifications;
