import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const AdminBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    checkAdminAccess();
    loadBookings();
    loadTours();
  }, []);

  const checkAdminAccess = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
      navigate('/login');
    }
  };

  const loadBookings = async () => {
    try {
      const response = await tourismAPI.getBookings();
      setBookings(response.data);
    } catch (error) {
      console.error('Ошибка загрузки бронирований:', error);
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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Ожидание';
      case 'confirmed': return 'Подтверждено';
      case 'cancelled': return 'Отменено';
      default: return status;
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

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      await tourismAPI.updateBooking(bookingId, { status: newStatus });
      loadBookings(); // Перезагружаем список
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      alert('Ошибка при обновлении статуса бронирования');
    }
  };

  const deleteBooking = async (bookingId) => {
    if (window.confirm('Вы уверены, что хотите удалить это бронирование?')) {
      try {
        await tourismAPI.deleteBooking(bookingId);
        loadBookings();
      } catch (error) {
        console.error('Ошибка удаления бронирования:', error);
        alert('Ошибка при удалении бронирования');
      }
    }
  };

  // Фильтрация бронирований
  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

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
        }}>Загрузка бронирований...</div>
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
        <h1>Управление бронированиями</h1>
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
            Все ({bookings.length})
          </button>
          <button 
            onClick={() => setFilter('pending')}
            style={{
              backgroundColor: filter === 'pending' ? '#f39c12' : '#ecf0f1',
              color: filter === 'pending' ? 'white' : '#333',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Ожидание ({bookings.filter(b => b.status === 'pending').length})
          </button>
          <button 
            onClick={() => setFilter('confirmed')}
            style={{
              backgroundColor: filter === 'confirmed' ? '#27ae60' : '#ecf0f1',
              color: filter === 'confirmed' ? 'white' : '#333',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Подтверждено ({bookings.filter(b => b.status === 'confirmed').length})
          </button>
          <button 
            onClick={() => setFilter('cancelled')}
            style={{
              backgroundColor: filter === 'cancelled' ? '#e74c3c' : '#ecf0f1',
              color: filter === 'cancelled' ? 'white' : '#333',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Отменено ({bookings.filter(b => b.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '1.5rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <h3 style={{ color: '#3498db', marginBottom: '0.5rem' }}>Всего</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{bookings.length}</p>
        </div>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '1.5rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <h3 style={{ color: '#27ae60', marginBottom: '0.5rem' }}>Подтверждено</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {bookings.filter(b => b.status === 'confirmed').length}
          </p>
        </div>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '1.5rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <h3 style={{ color: '#f39c12', marginBottom: '0.5rem' }}>Ожидание</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            {bookings.filter(b => b.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Таблица бронирований */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2>Список бронирований</h2>
        
        {filteredBookings.length === 0 ? (
          <p>Нет бронирований для отображения</p>
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
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Дата бронирования</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Статус</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Человек</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(booking => (
                  <tr key={booking.id}>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{booking.id}</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {getTourTitle(booking.tour_id)}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {formatDate(booking.booking_date)}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        color: 'white',
                        fontSize: '0.9rem',
                        backgroundColor: getStatusColor(booking.status)
                      }}>
                        {getStatusText(booking.status)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {booking.people_count}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {booking.status !== 'confirmed' && (
                          <button 
                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                            style={{
                              backgroundColor: '#27ae60',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                            }}
                          >
                            Подтвердить
                          </button>
                        )}
                        {booking.status !== 'cancelled' && (
                          <button 
                            onClick={() => updateBookingStatus(booking.id, 'cancelled')}
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
                            Отменить
                          </button>
                        )}
                        <button 
                          onClick={() => deleteBooking(booking.id)}
                          style={{
                            backgroundColor: '#95a5a6',
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
                      </div>
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

export default AdminBookings;
