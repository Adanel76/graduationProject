import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Завершаем регистрацию с кодом подтверждения
      const response = await tourismAPI.completeRegistration({
        email: email,
        code: code
      });
      
      setSuccess(true);
      
      // Автоматически перенаправляем на вход через 3 секунды
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (error) {
      console.error('Ошибка подтверждения email:', error);
      if (error.response?.status === 400) {
        setError('Неверный код подтверждения или код истек');
      } else {
        setError('Ошибка подтверждения email. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setResendSuccess(false);
    setError(null);

    try {
      await tourismAPI.resendVerificationCode(email);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000); // Скрываем сообщение через 5 секунд
    } catch (error) {
      console.error('Ошибка повторной отправки кода:', error);
      if (error.response?.status === 400) {
        setError('Ошибка повторной отправки. Начните регистрацию заново.');
      } else {
        setError('Ошибка повторной отправки кода. Попробуйте позже.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#2c3e50',
        }}>
          Подтверждение email
        </h2>
        
        <form onSubmit={handleCodeSubmit} style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Код подтверждения отправлен на <strong>{email}</strong>
            </p>
            <label htmlFor="code" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}>Код подтверждения:</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="Введите 6-значный код"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                fontSize: '1rem',
                textAlign: 'center',
                letterSpacing: '5px',
              }}
            />
          </div>
          
          {error && <div style={{
            color: '#e74c3c',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>{error}</div>}
          
          {success && <div style={{
            color: '#27ae60',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>Email успешно подтвержден! Регистрация завершена. Перенаправление на вход...</div>}
          
          {resendSuccess && <div style={{
            color: '#3498db',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>Новый код отправлен на ваш email!</div>}
          
          <button 
            type="submit" 
            disabled={loading || success}
            style={{
              width: '100%',
              backgroundColor: success ? '#27ae60' : '#3498db',
              color: 'white',
              border: 'none',
              padding: '12px 30px',
              fontSize: '1rem',
              borderRadius: '5px',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s',
              opacity: loading || success ? 0.7 : 1,
              marginBottom: '1rem',
            }}
          >
            {loading ? 'Проверка...' : success ? 'Успешно!' : 'Подтвердить'}
          </button>
          
          <button 
            type="button"
            onClick={handleResendCode}
            disabled={resending || success}
            style={{
              width: '100%',
              backgroundColor: '#f39c12',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              fontSize: '0.9rem',
              borderRadius: '5px',
              cursor: resending || success ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s',
              opacity: resending || success ? 0.7 : 1,
            }}
          >
            {resending ? 'Отправка...' : 'Отправить код повторно'}
          </button>
        </form>
        
        <p style={{
          textAlign: 'center',
          marginTop: '1rem',
        }}>
          <Link to="/register" style={{
            color: '#3498db',
            textDecoration: 'none',
          }}>← Назад к регистрации</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
