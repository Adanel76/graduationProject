import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tour, peopleCount } = location.state || {};
  
  const [step, setStep] = useState(1); // 1 - контактная информация, 2 - подтверждение, 3 - завершено
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Данные пользователя
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  
  // Состояние оплаты
  const [paymentMethod, setPaymentMethod] = useState('card');
  
  useEffect(() => {
    // Загружаем данные текущего пользователя
    loadCurrentUser();
  }, []);
  
  const loadCurrentUser = async () => {
    try {
      const response = await tourismAPI.getCurrentUser();
      const user = response.data;
      setUserData({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        address: '',
        notes: ''
      });
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
    }
  };
  
  // Расчет цены
  const calculatePrice = () => {
    if (!tour || !peopleCount) return { finalPrice: 0, discount: 0, discountAmount: 0 };
    
    const basePrice = tour.price;
    const totalPrice = basePrice * peopleCount;
    
    // Система скидок
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
  
  const priceInfo = calculatePrice();
  
  const handleUserDataChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value
    });
  };
  
    const handleConfirmBooking = async () => {
    setLoading(true);
    setError(null);
    
    try {
        // Создаем бронирование
        const bookingData = {
        tour_id: tour.id,
        people_count: peopleCount
        };
        
        await tourismAPI.createBooking(bookingData);
        
        // Переходим к завершению
        setStep(3);
        
        // Показываем уведомление
        alert('Бронирование успешно оформлено! Подробная информация отправлена на ваш email.');
        
    } catch (error) {
        console.error('Ошибка бронирования:', error);
        setError('Ошибка при оформлении бронирования. Попробуйте позже.');
    } finally {
        setLoading(false);
    }
    };

  
  // Проверяем данные ПОСЛЕ всех хуков
  if (!tour || !peopleCount) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Ошибка</h2>
          <p>Не удалось загрузить данные для бронирования</p>
          <button 
            onClick={() => navigate('/tours')}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '1rem',
            }}
          >
            Вернуться к турам
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#2c3e50' }}>
        Оформление бронирования
      </h1>
      
      {/* Прогресс бронирования */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          top: '15px',
          left: '0',
          right: '0',
          height: '2px',
          backgroundColor: '#ddd',
          zIndex: 1,
        }}></div>
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} style={{ 
            textAlign: 'center', 
            zIndex: 2, 
            backgroundColor: 'white',
            padding: '0 10px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: step >= stepNum ? '#3498db' : '#ddd',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.5rem',
              fontWeight: 'bold',
            }}>
              {stepNum}
            </div>
            <div style={{ 
              fontSize: '0.8rem',
              color: step >= stepNum ? '#3498db' : '#999'
            }}>
              {stepNum === 1 && 'Контакты'}
              {stepNum === 2 && 'Подтверждение'}
              {stepNum === 3 && 'Завершено'}
            </div>
          </div>
        ))}
      </div>
      
      {/* Шаг 1: Контактная информация */}
      {step === 1 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
            Контактная информация
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Имя *
              </label>
              <input
                type="text"
                name="firstName"
                value={userData.firstName}
                onChange={handleUserDataChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Фамилия *
              </label>
              <input
                type="text"
                name="lastName"
                value={userData.lastName}
                onChange={handleUserDataChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={userData.email}
                onChange={handleUserDataChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Телефон *
              </label>
              <input
                type="tel"
                name="phone"
                value={userData.phone}
                onChange={handleUserDataChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Адрес (необязательно)
            </label>
            <input
              type="text"
              name="address"
              value={userData.address}
              onChange={handleUserDataChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem',
              }}
            />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Дополнительные пожелания
            </label>
            <textarea
              name="notes"
              value={userData.notes}
              onChange={handleUserDataChange}
              rows="3"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem',
                resize: 'vertical',
              }}
              placeholder="Особые пожелания по бронированию..."
            />
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button 
              onClick={() => navigate(-1)}
              style={{
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Назад
            </button>
            
            <button 
              onClick={() => setStep(2)}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Продолжить
            </button>
          </div>
        </div>
      )}
      
      {/* Шаг 2: Подтверждение заказа */}
      {step === 2 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
        }}>
          {/* Детали заказа */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '2rem',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              Детали заказа
            </h2>
            
            {/* Информация о туре */}
            <div style={{
              display: 'flex',
              marginBottom: '1.5rem',
              paddingBottom: '1.5rem',
              borderBottom: '1px solid #eee',
            }}>
              <div style={{ 
                width: '120px', 
                height: '80px', 
                marginRight: '1rem',
                overflow: 'hidden',
                borderRadius: '5px',
              }}>
                <img 
                  src={tour.image_data || 'https://via.placeholder.com/120x80/3498db/ffffff?text=Tour'} 
                  alt={tour.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                  {tour.title}
                </h3>
                <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                  {tour.city}, {tour.country}
                </p>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  {tour.duration} дней | {new Date(tour.start_date).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
            
            {/* Информация о бронировании */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Информация о бронировании</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <strong>Количество человек:</strong>
                  <div>{peopleCount}</div>
                </div>
                <div>
                  <strong>Контактное лицо:</strong>
                  <div>{userData.firstName} {userData.lastName}</div>
                </div>
                <div>
                  <strong>Email:</strong>
                  <div>{userData.email}</div>
                </div>
                <div>
                  <strong>Телефон:</strong>
                  <div>{userData.phone}</div>
                </div>
              </div>
              
              {userData.notes && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Пожелания:</strong>
                  <div>{userData.notes}</div>
                </div>
              )}
            </div>
            
            {/* Способ оплаты */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Способ оплаты</h4>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Банковская карта
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="payment"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Наличные
                </label>
              </div>
            </div>
          </div>
          
          {/* Итог заказа */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '2rem',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            height: 'fit-content',
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              Итог заказа
            </h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span>Цена за человека:</span>
                <span>{tour.price.toLocaleString('ru-RU')} ₽</span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span>Количество человек:</span>
                <span>{peopleCount}</span>
              </div>
              
              {peopleCount > 1 && (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}>
                    <span>Общая цена:</span>
                    <span>{priceInfo.totalPrice.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  
                  {priceInfo.discount > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      color: '#27ae60',
                    }}>
                      <span>Скидка ({(priceInfo.discount * 100).toFixed(0)}%):</span>
                      <span>-{priceInfo.discountAmount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #eee',
              paddingTop: '1rem',
              marginTop: '1rem',
              fontWeight: 'bold',
              fontSize: '1.2rem',
              color: '#e74c3c',
            }}>
              <span>Итого к оплате:</span>
              <span>{priceInfo.finalPrice.toLocaleString('ru-RU')} ₽</span>
            </div>
            
            {priceInfo.discount > 0 && (
              <div style={{
                textAlign: 'center',
                marginTop: '0.5rem',
                fontSize: '0.9rem',
                color: '#27ae60',
                fontWeight: 'bold',
              }}>
                Вы экономите: {priceInfo.discountAmount.toLocaleString('ru-RU')} ₽
              </div>
            )}
            
            {error && (
              <div style={{
                color: '#e74c3c',
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fdf2f2',
                borderRadius: '5px',
                border: '1px solid #fecaca',
              }}>
                {error}
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '1.5rem'
            }}>
              <button 
                onClick={handleConfirmBooking}
                disabled={loading}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  fontWeight: 'bold',
                }}
              >
                {loading ? 'Оформление...' : 'Подтвердить бронирование'}
              </button>
              
              <button 
                onClick={() => setStep(1)}
                style={{
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                Изменить данные
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Шаг 3: Завершено */}
      {step === 3 && (
        <div style={{
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '3rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ marginBottom: '1rem', color: '#27ae60' }}>
            Бронирование успешно оформлено!
          </h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.1rem', color: '#666' }}>
            Спасибо за бронирование! Наши менеджеры свяжутся с вами в ближайшее время.
          </p>
          
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            textAlign: 'left',
            maxWidth: '400px',
            margin: '0 auto 2rem',
          }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Детали бронирования:</h3>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Тур:</strong> {tour.title}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Количество человек:</strong> {peopleCount}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Итоговая цена:</strong> {priceInfo.finalPrice.toLocaleString('ru-RU')} ₽
            </div>
            <div>
              <strong>Статус:</strong> <span style={{ color: '#f39c12' }}>Ожидает подтверждения</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button 
              onClick={() => navigate('/profile')}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Перейти в профиль
            </button>
            
            <button 
              onClick={() => navigate('/tours')}
              style={{
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Посмотреть другие туры
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
