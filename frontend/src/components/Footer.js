import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo">
            <span className="site-footer__mark">✦</span>
            <span>
              <strong>Travel Agency</strong>
              <small>tourism intelligence platform</small>
            </span>
          </Link>

          <p>
            Информационно-аналитическая система туристического агентства:
            подбор туров, бронирования, мероприятия и аналитика.
          </p>
        </div>

        <div className="site-footer__column">
          <h4>Навигация</h4>
          <Link to="/">Главная</Link>
          <Link to="/tours">Туры</Link>
          <Link to="/tour-constructor">Конструктор</Link>
          <Link to="/events">Мероприятия</Link>
          <Link to="/about">О нас</Link>
        </div>

        <div className="site-footer__column">
          <h4>Клиентам</h4>
          <Link to="/profile">Личный кабинет</Link>
          <Link to="/favorites">Избранное</Link>
          <Link to="/my-bookings">Мои заявки</Link>
        </div>

        <div className="site-footer__column">
          <h4>Контакты</h4>
          <span>Ростов-на-Дону</span>
          <span>support@travel-agency.local</span>
          <span>Пн–Пт: 09:00–18:00</span>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© 2026 Travel Agency</span>
        <span>Дипломный проект: веб-приложение туристического агентства</span>
      </div>
    </footer>
  );
};

export default Footer;
