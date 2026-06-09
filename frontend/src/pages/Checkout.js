import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTourCardImageSrc, tourismAPI } from '../services/api';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tour,
    peopleCount,
    checkoutMode,
    customPlanId,
    customPlanPayload,
    customTotalPrice,
  } = location.state || {};
  const isCustomTour = checkoutMode === 'custom-tour';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('card');

  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await tourismAPI.getCurrentUser();
      const user = response.data;

      setUserData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: '',
        notes: customPlanPayload?.special_requests || ''
      });
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
      navigate('/login');
    }
  }, [customPlanPayload?.special_requests, navigate]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const calculatePrice = () => {
    if (!tour || !peopleCount) {
      return {
        totalPrice: 0,
        discount: 0,
        discountAmount: 0,
        finalPrice: 0
      };
    }

    if (isCustomTour) {
      const finalPrice = Number(customTotalPrice || 0);
      return {
        totalPrice: finalPrice,
        discount: 0,
        discountAmount: 0,
        finalPrice
      };
    }

    const basePrice = Number(tour.price);
    const totalPrice = basePrice * peopleCount;

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
  const availableSeats = isCustomTour
    ? Number(peopleCount || 0)
    : Number(tour?.available_seats ?? tour?.max_people ?? 0);

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
      if (!isCustomTour && peopleCount > availableSeats) {
        setError(`Свободных мест сейчас: ${availableSeats}`);
        return;
      }

      if (isCustomTour) {
        if (!customPlanId || !customPlanPayload) {
          setError('Не удалось загрузить индивидуальный план для оплаты');
          return;
        }

        const paymentLabel = paymentMethod === 'card' ? 'Банковская карта' : 'Наличные';
        const notes = [customPlanPayload.special_requests, userData.notes]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        notes.push(`Способ оплаты: ${paymentLabel}`);

        await tourismAPI.updateTourPlan(customPlanId, {
          ...customPlanPayload,
          special_requests: [...new Set(notes)].join('\n'),
          status: 'submitted',
        });
      } else {
        await tourismAPI.createBooking({
          tour_id: tour.id,
          people_count: peopleCount,
        });
      }

      window.dispatchEvent(new Event('notifications-updated'));
      setStep(3);
    } catch (error) {
      console.error('Ошибка бронирования:', error);

      if (error.response?.status === 401) {
        navigate('/login');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Ошибка при оформлении бронирования. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

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

  const imageSrc = getTourCardImageSrc(tour);
  const formattedStartDate = tour.start_date
    ? new Date(tour.start_date).toLocaleDateString('ru-RU')
    : 'даты согласовываются';

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#2c3e50' }}>
        Оформление бронирования
      </h1>

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
          <div
            key={stepNum}
            style={{
              textAlign: 'center',
              zIndex: 2,
              backgroundColor: 'white',
              padding: '0 10px'
            }}
          >
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

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
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
                style={inputStyle}
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
                style={inputStyle}
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
                style={inputStyle}
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
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Адрес
            </label>
            <input
              type="text"
              name="address"
              value={userData.address}
              onChange={handleUserDataChange}
              style={inputStyle}
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
                ...inputStyle,
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
              style={secondaryButtonStyle}
            >
              Назад
            </button>

            <button
              onClick={() => setStep(2)}
              style={primaryButtonStyle}
            >
              Продолжить
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '2rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '2rem',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>
              Детали заказа
            </h2>

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
                  src={imageSrc}
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
                  {tour.duration} дней | {formattedStartDate}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0' }}>Информация о бронировании</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <strong>Количество человек:</strong>
                  <div>{peopleCount}</div>
                </div>
                {!isCustomTour && (
                  <div>
                    <strong>Свободных мест:</strong>
                    <div>{availableSeats}</div>
                  </div>
                )}
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
              {!isCustomTour && (
                <div style={summaryRowStyle}>
                  <span>Цена за человека:</span>
                  <span>{Number(tour.price).toLocaleString('ru-RU')} ₽</span>
                </div>
              )}

              <div style={summaryRowStyle}>
                <span>Количество человек:</span>
                <span>{peopleCount}</span>
              </div>

              {!isCustomTour && peopleCount > 1 && (
                <>
                  <div style={summaryRowStyle}>
                    <span>Общая цена:</span>
                    <span>{priceInfo.totalPrice.toLocaleString('ru-RU')} ₽</span>
                  </div>

                  {priceInfo.discount > 0 && (
                    <div style={{
                      ...summaryRowStyle,
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
                  ...successButtonStyle,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? 'Оформление...'
                  : isCustomTour
                    ? 'Подтвердить и оплатить'
                    : 'Подтвердить бронирование'}
              </button>

              <button
                onClick={() => setStep(1)}
                style={secondaryButtonStyle}
              >
                Изменить данные
              </button>
            </div>
          </div>
        </div>
      )}

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
            {isCustomTour
              ? 'Индивидуальный тур передан в обработку!'
              : 'Бронирование успешно оформлено!'}
          </h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.1rem', color: '#666' }}>
            {isCustomTour
              ? 'Способ оплаты сохранён. Менеджер проверит индивидуальную программу и свяжется с вами.'
              : 'Спасибо за бронирование! Наши менеджеры свяжутся с вами в ближайшее время.'}
          </p>

          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
            textAlign: 'left',
            maxWidth: '450px',
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
              <strong>Статус:</strong>{' '}
              <span style={{ color: '#f39c12' }}>Ожидает подтверждения</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/profile')}
              style={primaryButtonStyle}
            >
              Перейти в профиль
            </button>

            <button
              onClick={() => navigate('/tours')}
              style={secondaryButtonStyle}
            >
              Посмотреть другие туры
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '5px',
  fontSize: '1rem',
};

const primaryButtonStyle = {
  backgroundColor: '#3498db',
  color: 'white',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '5px',
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  backgroundColor: '#95a5a6',
  color: 'white',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '5px',
  cursor: 'pointer',
};

const successButtonStyle = {
  backgroundColor: '#27ae60',
  color: 'white',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
};

const summaryRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};

export default Checkout;
