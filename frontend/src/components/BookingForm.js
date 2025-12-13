import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BookingForm = ({ tour, onBookingSuccess }) => {
  const navigate = useNavigate();
  const [peopleCount, setPeopleCount] = useState(1);
  const [error, setError] = useState(null);

  // Расчет цены со скидкой
  const calculateTotalPrice = () => {
    // Проверяем, что tour существует
    if (!tour) {
      return {
        totalPrice: 0,
        discount: 0,
        discountAmount: 0,
        finalPrice: 0
      };
    }
    
    const basePrice = tour.price || 0;
    const totalPrice = basePrice * peopleCount;
    
    // Система скидок:
    let discount = 0;
    if (peopleCount >= 7) {
      discount = 0.15;
    } else if (peopleCount >= 4) {
      discount = 0.10;
    } else if (peopleCount >= 2) {
      discount = 0.05;
    }
    
    const discountAmount = totalPrice * discount;
    const finalPrice = totalPrice - discountAmount;
    
    return {
      totalPrice,
      discount,
      discountAmount,
      finalPrice
    };
  };

  const priceInfo = calculateTotalPrice();

  const handleBook = () => {
    // Проверяем, что tour существует
    if (!tour) {
      setError('Ошибка загрузки данных тура');
      return;
    }
    
    if (peopleCount < 1) {
      setError('Количество человек должно быть больше 0');
      return;
    }
    
    if (peopleCount > tour.max_people) {
      setError(`Максимальное количество человек: ${tour.max_people}`);
      return;
    }
    
    // Переходим на страницу оформления заказа
    navigate('/checkout', { 
      state: { 
        tour: tour, 
        peopleCount: peopleCount 
      } 
    });
  };

  // Проверяем, что tour существует перед отображением
  if (!tour) {
    return (
      <div style={{
        maxWidth: '400px',
        backgroundColor: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p>Загрузка данных тура...</p>
      </div>
    );
  }

  return (
    <form style={{
      maxWidth: '400px',
      backgroundColor: '#f8f9fa',
      padding: '1.5rem',
      borderRadius: '8px',
    }}>
      <h3 style={{ 
        marginBottom: '1rem', 
        color: '#2c3e50',
        textAlign: 'center'
      }}>
        Бронирование тура
      </h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="people_count" style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: 'bold',
        }}>
          Количество человек:
        </label>
        <input
          type="number"
          id="people_count"
          min="1"
          max={tour.max_people}
          value={peopleCount}
          onChange={(e) => setPeopleCount(parseInt(e.target.value) || 1)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '1rem',
          }}
        />
        <div style={{ 
          fontSize: '0.85rem', 
          color: '#666', 
          marginTop: '0.25rem' 
        }}>
          Максимум: {tour.max_people} человек
        </div>
        
        {/* Информация о цене */}
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: '5px',
          border: '1px solid #eee',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
          }}>
            <span>Цена за человека:</span>
            <span>{tour.price.toLocaleString('ru-RU')} ₽</span>
          </div>
          
          {peopleCount > 1 && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
              }}>
                <span>Количество человек:</span>
                <span>{peopleCount}</span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
              }}>
                <span>Общая цена:</span>
                <span>{priceInfo.totalPrice.toLocaleString('ru-RU')} ₽</span>
              </div>
              
              {priceInfo.discount > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  color: '#27ae60',
                }}>
                  <span>Скидка ({(priceInfo.discount * 100).toFixed(0)}%):</span>
                  <span>-{priceInfo.discountAmount.toLocaleString('ru-RU')} ₽</span>
                </div>
              )}
            </>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #eee',
            paddingTop: '0.75rem',
            marginTop: '0.5rem',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#e74c3c',
          }}>
            <span>Итого к оплате:</span>
            <span>{priceInfo.finalPrice.toLocaleString('ru-RU')} ₽</span>
          </div>
          
          {priceInfo.discount > 0 && (
            <div style={{
              textAlign: 'center',
              marginTop: '0.5rem',
              fontSize: '0.85rem',
              color: '#27ae60',
              fontWeight: 'bold',
            }}>
              Вы экономите: {priceInfo.discountAmount.toLocaleString('ru-RU')} ₽
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div style={{
          color: '#e74c3c',
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fdf2f2',
          borderRadius: '5px',
          border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}
      
      <button 
        type="button"
        onClick={handleBook}
        style={{
          width: '100%',
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          padding: '12px 30px',
          fontSize: '1rem',
          borderRadius: '5px',
          cursor: 'pointer',
          transition: 'background 0.3s',
          fontWeight: 'bold',
        }}
      >
        Перейти к оформлению
      </button>
      
      {/* Информация о скидках */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#e3f2fd',
        borderRadius: '5px',
        fontSize: '0.85rem',
      }}>
        <h4 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '0.95rem',
          color: '#1976d2'
        }}>
          Система скидок:
        </h4>
        <ul style={{
          margin: '0.25rem 0 0 1.2rem',
          padding: 0,
          fontSize: '0.85rem',
        }}>
          <li style={{ marginBottom: '0.25rem' }}>2-3 человека: 5% скидка</li>
          <li style={{ marginBottom: '0.25rem' }}>4-6 человек: 10% скидка</li>
          <li>7+ человек: 15% скидка</li>
        </ul>
      </div>
    </form>
  );
};

export default BookingForm;
