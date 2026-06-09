import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      await api.post('/users/forgot-password', {
        email,
      });

      setSuccessMessage(
        'Если аккаунт существует, инструкция или код для восстановления уже отправлены на почту.'
      );
    } catch (err) {
      console.error('Ошибка запроса восстановления:', err);
      setError(err.response?.data?.detail || 'Не удалось отправить запрос на восстановление');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="page-shell">
        <div className="auth-layout auth-layout--compact">
          <section className="auth-visual">
            <span className="home-hero__eyebrow">Travel Agency</span>
            <h1 className="auth-visual__title">Восстановление доступа</h1>
            <p className="auth-visual__text">
              Укажите email, который использовался при регистрации, и система
              отправит инструкции для восстановления пароля.
            </p>
          </section>

          <section className="auth-card">
            <div className="auth-card__head">
              <h2>Забыли пароль?</h2>
              <p>Введите email для восстановления доступа</p>
            </div>

            {error && <div className="detail-alert detail-alert--error">{error}</div>}
            {successMessage && (
              <div className="detail-alert detail-alert--success">{successMessage}</div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                className="site-button site-button--primary auth-submit"
                disabled={loading}
              >
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
            </form>

            <div className="auth-links">
              <Link to="/login">Вернуться ко входу</Link>
              <Link to="/register">Создать аккаунт</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;