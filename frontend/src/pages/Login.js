import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Сначала логин
      const loginResponse = await tourismAPI.login({
        email: formData.email,
        password: formData.password
      });

      const token = loginResponse.data.access_token;
      localStorage.setItem('token', token);

      // Затем получаем информацию о пользователе
      try {
        const userResponse = await tourismAPI.getCurrentUser();
        const user = userResponse.data;
        localStorage.setItem('userRole', user.role);
      } catch (userError) {
        // Если не получили данные пользователя, ставим роль по умолчанию
        localStorage.setItem('userRole', 'client');
      }

      // Перенаправляем в профиль без alert
      window.location.href = '/profile';
      
    } catch (error) {
      if (error.code === 'ERR_NETWORK') {
        setError('Ошибка сети. Проверьте, запущен ли сервер.');
      } else if (error.response?.status === 401) {
        setError('Неверный email или пароль');
      } else {
        setError('Ошибка входа. Попробуйте позже.');
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
        }}>Вход в систему</h2>
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}>Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
          
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
            }}>Пароль:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
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
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        
        {/* Кнопка "Забыли пароль?" */}
        <p style={{
          textAlign: 'center',
          marginTop: '1rem',
        }}>
          <Link to="/forgot-password" style={{
            color: '#3498db',
            textDecoration: 'none',
          }}>Забыли пароль?</Link>
        </p>
        
        {/* Ссылка на регистрацию осталась для прямого доступа */}
        <p style={{
          textAlign: 'center',
          marginTop: '1rem',
        }}>
          Нет аккаунта? <Link to="/register" style={{
            color: '#3498db',
            textDecoration: 'none',
          }}>Зарегистрируйтесь</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
