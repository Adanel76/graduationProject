import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BookingForm = ({ tour }) => {
  const navigate = useNavigate();
  const availableSeats = Number(tour?.available_seats ?? tour?.max_people ?? 0);
  const [peopleCount, setPeopleCount] = useState(1);
  const [error, setError] = useState(null);

  const priceInfo = useMemo(() => {
    const basePrice = Number(tour?.price || 0);
    const totalPrice = basePrice * peopleCount;
    let discount = 0;

    if (peopleCount >= 7) discount = 0.15;
    else if (peopleCount >= 4) discount = 0.1;
    else if (peopleCount >= 2) discount = 0.05;

    const discountAmount = totalPrice * discount;
    const finalPrice = totalPrice - discountAmount;

    return { totalPrice, discount, discountAmount, finalPrice };
  }, [peopleCount, tour?.price]);

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  const handleBook = () => {
    if (!tour) {
      setError('Ошибка загрузки данных тура');
      return;
    }

    if (availableSeats <= 0) {
      setError('На этот тур больше нет свободных мест');
      return;
    }

    if (peopleCount < 1) {
      setError('Количество человек должно быть больше 0');
      return;
    }

    if (peopleCount > availableSeats) {
      setError(`Свободных мест сейчас: ${availableSeats}`);
      return;
    }

    navigate('/checkout', {
      state: {
        tour,
        peopleCount,
      },
    });
  };

  if (!tour) {
    return <div className="booking-widget booking-widget--empty">Загрузка данных тура...</div>;
  }

  return (
    <section className="booking-widget">
      <div className="booking-widget__head">
        <span className="home-hero__eyebrow">Booking</span>
        <h3>Бронирование тура</h3>
        <p>Выберите количество туристов. Места резервируются после создания заявки.</p>
      </div>

      <div className="booking-widget__availability">
        <span>Свободно мест</span>
        <strong>{availableSeats} из {tour.max_people}</strong>
      </div>

      <div className="booking-widget__field">
        <label htmlFor="people_count">Количество человек</label>
        <input
          type="number"
          id="people_count"
          min="1"
          max={Math.max(availableSeats, 1)}
          value={peopleCount}
          onChange={(e) => {
            setError(null);
            setPeopleCount(Number(e.target.value) || 1);
          }}
          disabled={availableSeats <= 0}
        />
      </div>

      <div className="booking-widget__summary">
        <div>
          <span>Цена за человека</span>
          <strong>{formatMoney(tour.price)}</strong>
        </div>
        <div>
          <span>Туристов</span>
          <strong>{peopleCount}</strong>
        </div>
        {priceInfo.discount > 0 && (
          <div className="booking-widget__discount">
            <span>Скидка {(priceInfo.discount * 100).toFixed(0)}%</span>
            <strong>-{formatMoney(priceInfo.discountAmount)}</strong>
          </div>
        )}
        <div className="booking-widget__total">
          <span>Итого</span>
          <strong>{formatMoney(priceInfo.finalPrice)}</strong>
        </div>
      </div>

      {error && <div className="detail-alert detail-alert--error">{error}</div>}

      <button
        type="button"
        className="site-button site-button--primary booking-widget__button"
        onClick={handleBook}
        disabled={availableSeats <= 0}
      >
        {availableSeats <= 0 ? 'Мест нет' : 'Перейти к оформлению'}
      </button>

      <div className="booking-widget__hint">
        <strong>Скидки для группы:</strong> 2–3 человека — 5%, 4–6 человек — 10%, 7+ человек — 15%.
      </div>
    </section>
  );
};

export default BookingForm;
