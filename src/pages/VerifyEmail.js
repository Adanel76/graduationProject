import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const stateEmail = location.state?.email || '';
  const storedEmail = localStorage.getItem('pendingVerificationEmail') || '';

  const initialEmail = useMemo(() => {
    return (stateEmail || storedEmail || '').trim().toLowerCase();
  }, [stateEmail, storedEmail]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleVerify = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail) {
      setError('Введите email');
      return;
    }

    if (!normalizedCode) {
      setError('Введите код подтверждения');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await tourismAPI.verifyEmail({
        email: normalizedEmail,
        code: normalizedCode,
      });

      localStorage.removeItem('pendingVerificationEmail');

      setSuccess(
        response?.data?.message || 'Email успешно подтверждён. Теперь можно войти.'
      );

      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (err) {
      console.error('Ошибка подтверждения email:', err);

      const serverMessage = err?.response?.data?.detail;

      if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === 'ECONNABORTED') {
        setError('Сервер слишком долго отвечает. Попробуйте ещё раз.');
      } else {
        setError('Не удалось подтвердить email.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Сначала введите email');
      return;
    }

    setResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await tourismAPI.resendCode({
        email: normalizedEmail,
      });

      localStorage.setItem('pendingVerificationEmail', normalizedEmail);

      setSuccess(
        response?.data?.message || 'Новый код подтверждения отправлен на email.'
      );
    } catch (err) {
      console.error('Ошибка повторной отправки кода:', err);

      const serverMessage = err?.response?.data?.detail;

      if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === 'ECONNABORTED') {
        setError('Сервер слишком долго отвечает. Попробуйте ещё раз.');
      } else {
        setError('Не удалось повторно отправить код.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-layout auth-layout--compact">
        <section className="auth-visual">
          <div>
            <span className="home-hero__eyebrow">Travel Agency</span>
            <h1 className="auth-visual__title">Подтвердите email</h1>
            <p className="auth-visual__text">
              Мы отправили код подтверждения на вашу почту. Введите его, чтобы
              завершить регистрацию и активировать аккаунт.
            </p>
          </div>

          <div className="auth-visual__features">
            <div className="auth-feature">
              <strong>Безопасность</strong>
              <span>Подтверждение email защищает аккаунт и завершает регистрацию.</span>
            </div>

            <div className="auth-feature">
              <strong>Быстрое повторение</strong>
              <span>Если письмо не пришло, вы можете запросить новый код.</span>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card__head">
            <h2>Подтверждение email</h2>
            <p>Введите email и код, который пришёл вам на почту.</p>
          </div>

          <form className="auth-form" onSubmit={handleVerify}>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                  if (success) setSuccess('');
                }}
                placeholder="Введите email"
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="code">Код подтверждения</label>
              <input
                id="code"
                name="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError('');
                  if (success) setSuccess('');
                }}
                placeholder="Введите код из письма"
              />
            </div>

            {error && <div className="detail-alert detail-alert--error">{error}</div>}
            {success && (
              <div className="detail-alert detail-alert--success">{success}</div>
            )}

            <button
              type="submit"
              className="site-button site-button--primary auth-submit"
              disabled={loading}
            >
              {loading ? 'Подтверждение...' : 'Подтвердить email'}
            </button>

            <button
              type="button"
              className="site-button site-button--secondary auth-submit"
              onClick={handleResendCode}
              disabled={resending}
            >
              {resending ? 'Отправка...' : 'Отправить код повторно'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/register">Назад к регистрации</Link>
            <Link to="/login">Перейти ко входу</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VerifyEmail;