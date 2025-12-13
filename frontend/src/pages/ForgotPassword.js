import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('request'); // 'request' или 'reset'
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState(''); // Для отображения кода

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedCode('');

    try {
      console.log('Отправка запроса сброса пароля для:', email);
      // Отправляем запрос на сброс пароля
      const response = await tourismAPI.requestPasswordReset({ email });
      console.log('Ответ сервера:', response.data);
      
      setSuccess(true);
      setStep('reset');
      
      // Показываем код из ответа
      if (response.data.code) {
        setGeneratedCode(response.data.code);
      }
      
    } catch (error) {
      console.error('Ошибка запроса сброса пароля:', error);
      console.error('Детали ошибки:', error.response);
      setError('Ошибка отправки кода. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Сброс пароля для:', email);
      // Отправляем запрос на сброс пароля
      const response = await tourismAPI.resetPassword({
        email: email,
        code: resetCode,
        new_password: newPassword
      });
      console.log('Ответ сервера:', response.data);
      
      alert('Пароль успешно изменен!');
      navigate('/login');
    } catch (error) {
      console.error('Ошибка сброса пароля:', error);
      console.error('Детали ошибки:', error.response);
      if (error.response?.status === 400) {
        setError('Неверный код сброса или код истек');
      } else {
        setError('Ошибка сброса пароля. Попробуйте снова.');
      }
    } finally {
      setLoading(false);
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
          {step === 'request' ? 'Восстановление пароля' : 'Сброс пароля'}
        </h2>
        
        {step === 'request' && (
          <form onSubmit={handleRequestReset} style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
              }}>Email:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            
            {error && <div style={{
              color: '#e74c3c',
              marginBottom: '1rem',
              textAlign: 'center',
            }}>{error}</div>}
            
            {success && (
              <div style={{
                color: '#27ae60',
                marginBottom: '1rem',
                textAlign: 'center',
              }}>
                Код сгенерирован! 
                {generatedCode && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '1.2rem', 
                    fontWeight: 'bold',
                    backgroundColor: '#f8f9fa',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ddd'
                  }}>
                    Ваш код: {generatedCode}
                  </div>
                )}
                <div style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.9rem',
                  color: '#666'
                }}>
                  Скопируйте этот код и вставьте ниже
                </div>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '12px 30px',
                fontSize: '1rem',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Отправка...' : 'Сгенерировать код'}
            </button>
          </form>
        )}
        
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="resetCode" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
              }}>Код из email:</label>
              <input
                type="text"
                id="resetCode"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                required
                placeholder="Введите 6-значный код"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
              {generatedCode && (
                <div style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.8rem',
                  color: '#666'
                }}>
                  Сгенерированный код: {generatedCode}
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="newPassword" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
              }}>Новый пароль:</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="confirmPassword" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
              }}>Подтвердите пароль:</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            {error && <div style={{
              color: '#e74c3c',
              marginBottom: '1rem',
              textAlign: 'center',
            }}>{error}</div>}
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '12px 30px',
                fontSize: '1rem',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Сброс...' : 'Сбросить пароль'}
            </button>
          </form>
        )}
        
        <p style={{
          textAlign: 'center',
          marginTop: '1rem',
        }}>
          <Link to="/login" style={{
            color: '#3498db',
            textDecoration: 'none',
          }}>← Назад к входу</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
