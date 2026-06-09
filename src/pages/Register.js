import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedAgreement: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateForm = () => {
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!formData.first_name.trim()) {
      setError('Введите имя');
      return false;
    }

    if (!normalizedEmail) {
      setError('Введите email');
      return false;
    }

    if (!formData.password) {
      setError('Введите пароль');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return false;
    }

    if (!formData.acceptedAgreement) {
      setError('Подтвердите согласие с пользовательским соглашением');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    };

    try {
      const response = await tourismAPI.registerUser(payload);

      const email = payload.email;
      localStorage.setItem('pendingVerificationEmail', email);

      setSuccess(
        response?.data?.message ||
          'Аккаунт создан. На вашу почту отправлен код подтверждения.'
      );

      setTimeout(() => {
        navigate('/verify-email', {
          state: { email },
        });
      }, 900);
    } catch (err) {
      console.error('Ошибка регистрации:', err);

      const serverMessage = err?.response?.data?.detail;

      if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === 'ECONNABORTED') {
        setError('Сервер слишком долго отвечает. Попробуйте ещё раз.');
      } else {
        setError('Не удалось зарегистрироваться. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-layout">
        <section className="auth-visual">
          <div>
            <span className="home-hero__eyebrow">Travel Agency</span>
            <h1 className="auth-visual__title">Создайте аккаунт</h1>
            <p className="auth-visual__text">
              Зарегистрируйтесь, чтобы бронировать туры, сохранять избранное,
              получать уведомления и пользоваться личным кабинетом.
            </p>
          </div>

          <div className="auth-visual__features">
            <div className="auth-feature">
              <strong>Бронирования</strong>
              <span>Хранение заявок и контроль их статусов.</span>
            </div>

            <div className="auth-feature">
              <strong>Избранное</strong>
              <span>Сохраняйте интересные направления и туры.</span>
            </div>

            <div className="auth-feature">
              <strong>Уведомления</strong>
              <span>Получайте важные изменения по вашим заявкам.</span>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card__head">
            <h2>Регистрация</h2>
            <p>Заполните данные для создания аккаунта.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form__grid">
              <div className="auth-field">
                <label htmlFor="first_name">Имя</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Введите имя"
                  autoComplete="given-name"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="last_name">Фамилия</label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Введите фамилию"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="phone">Телефон</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+7XXXXXXXXXX"
                autoComplete="tel"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Введите email"
                autoComplete="email"
              />
            </div>

            <div className="auth-form__grid">
              <div className="auth-field">
                <label htmlFor="password">Пароль</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Введите пароль"
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirmPassword">Подтверждение пароля</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && <div className="detail-alert detail-alert--error">{error}</div>}
            {success && (
              <div className="detail-alert detail-alert--success">{success}</div>
            )}

            <div className="auth-agreement-check">
              <input
                id="acceptedAgreement"
                name="acceptedAgreement"
                type="checkbox"
                checked={formData.acceptedAgreement}
                onChange={handleChange}
                aria-describedby="agreementText"
              />
              <div id="agreementText" className="auth-agreement-check__text">
                <label htmlFor="acceptedAgreement">Я принимаю условия</label>{' '}
                <Link to="/user-agreement">пользовательского соглашения</Link>
              </div>
            </div>

            <button
              type="submit"
              className="site-button site-button--primary auth-submit"
              disabled={loading}
            >
              {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/login">Уже есть аккаунт? Войти</Link>
            <Link to="/forgot-password">Забыли пароль?</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Register;
