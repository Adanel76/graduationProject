import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizeErrorMessage = (detail) => {
    if (!detail) {
      return 'Не удалось выполнить вход';
    }

    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item?.msg) return item.msg;
          return 'Некорректные данные';
        })
        .join(', ');
    }

    if (typeof detail === 'object') {
      if (detail.msg) return detail.msg;
      if (detail.detail) return normalizeErrorMessage(detail.detail);
      return 'Некорректный ответ сервера';
    }

    return 'Не удалось выполнить вход';
  };

  const getRedirectPathByRole = (user) => {
    const requestedPath = location.state?.from;

    if (requestedPath && typeof requestedPath === 'string' && requestedPath.startsWith('/')) {
      return requestedPath;
    }

    const role = user?.role;

    if (role === 'admin') return '/admin';
    if (role === 'manager') return '/admin/bookings';
    if (role === 'analyst') return '/admin/analytics';

    return '/profile';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) {
      setError('');
    }
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Введите email');
      return false;
    }

    if (!formData.password) {
      setError('Введите пароль');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const user = await login(formData);
      navigate(getRedirectPathByRole(user), { replace: true });
    } catch (err) {
      console.error('Ошибка входа:', err);

      const responseDetail = err?.response?.data?.detail;
      const message = normalizeErrorMessage(responseDetail);

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-layout auth-layout--compact">
        <section className="auth-visual">
          <div>
            <span className="home-hero__eyebrow">Travel Agency</span>
            <h1 className="auth-visual__title">Добро пожаловать обратно</h1>
            <p className="auth-visual__text">
              Войдите в аккаунт, чтобы управлять бронированиями, избранным,
              уведомлениями и персональными данными.
            </p>
          </div>

          <div className="auth-visual__features">
            <div className="auth-feature">
              <strong>Бронирования</strong>
              <span>Отслеживайте статусы заявок и историю поездок.</span>
            </div>

            <div className="auth-feature">
              <strong>Уведомления</strong>
              <span>Получайте важные изменения по заявкам и системе.</span>
            </div>

            <div className="auth-feature">
              <strong>Избранное</strong>
              <span>Быстрый доступ к понравившимся турам.</span>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card__head">
            <h2>Вход</h2>
            <p>Введите данные вашего аккаунта.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="detail-alert detail-alert--error">{error}</div>}

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

            <div className="auth-field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Введите пароль"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="site-button site-button--primary auth-submit"
              disabled={loading}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/forgot-password">Забыли пароль?</Link>
            <Link to="/register">Создать аккаунт</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
