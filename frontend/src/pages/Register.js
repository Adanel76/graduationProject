import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Проверка паролей
    if (formData.password !== formData.confirm_password) {
      setError('Пароли не совпадают');
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Начинаем регистрацию - отправляем код на email
      await tourismAPI.startRegistration({
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        password: formData.password
      });

      setSuccess(true);
      
      // Перенаправляем на страницу подтверждения email
      setTimeout(() => {
        navigate('/verify-email', { state: { email: formData.email } });
      }, 2000);
      
    } catch (error) {
      console.error('Ошибка начала регистрации:', error);
      if (error.response?.status === 400) {
        setError('Email уже зарегистрирован');
      } else {
        setError('Ошибка отправки кода подтверждения. Попробуйте позже.');
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
        maxWidth: '500px',
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#2c3e50',
        }}>Регистрация</h2>
        
        {success && (
          <div style={{
            backgroundColor: '#27ae60',
            color: 'white',
            padding: '1rem',
            borderRadius: '5px',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>
            Код подтверждения отправлен на ваш email! Перенаправление...
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>
          
          <div style={styles.formRow}>
            <div style={styles.formGroupHalf}>
              <label htmlFor="first_name" style={styles.label}>Имя:</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
            
            <div style={styles.formGroupHalf}>
              <label htmlFor="last_name" style={styles.label}>Фамилия:</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                style={styles.input}
              />
            </div>
          </div>
          
          <div style={styles.formGroup}>
            <label htmlFor="phone" style={styles.label}>Телефон:</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>Пароль:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              style={styles.input}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label htmlFor="confirm_password" style={styles.label}>Подтвердите пароль:</label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              minLength="6"
              style={styles.input}
            />
          </div>
          
          {error && <div style={styles.error}>{error}</div>}
          
          <button 
            type="submit" 
            disabled={loading || success}
            style={{
              ...styles.button,
              opacity: loading || success ? 0.7 : 1,
              cursor: loading || success ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Отправка кода...' : success ? 'Код отправлен!' : 'Зарегистрироваться'}
          </button>
        </form>
        
        <p style={styles.linkText}>
          Уже есть аккаунт? <Link to="/login" style={styles.link}>Войдите</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  formGroup: {
    marginBottom: '1rem',
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
  },
  formGroupHalf: {
    flex: 1,
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '1rem',
  },
  button: {
    width: '100%',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    fontSize: '1rem',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  error: {
    color: '#e74c3c',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  linkText: {
    textAlign: 'center',
    marginTop: '1rem',
  },
  link: {
    color: '#3498db',
    textDecoration: 'none',
  },
};

export default Register;
