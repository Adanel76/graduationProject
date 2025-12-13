import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminReports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState({});

  const handleExport = async (type, format) => {
    setLoading(prev => ({ ...prev, [`${type}_${format}`]: true }));
    
    try {
      // Формируем URL для экспорта
      const token = localStorage.getItem('token');
      const url = `http://127.0.0.1:8000/users/export/${type}/${format}`;
      
      // Создаем временный элемент для скачивания
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      link.setAttribute('download', '');
      
      // Добавляем токен в заголовки
      const headers = new Headers();
      headers.append('Authorization', `Bearer ${token}`);
      
      // Выполняем запрос
      const response = await fetch(url, { headers });
      
      if (response.ok) {
        // Получаем blob и создаем URL для скачивания
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        link.href = downloadUrl;
        link.download = `export_${type}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        throw new Error('Ошибка экспорта');
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Ошибка при экспорте данных. Попробуйте позже.');
    } finally {
      setLoading(prev => ({ ...prev, [`${type}_${format}`]: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1>Экспорт отчетов</h1>
        <div>
          <button 
            onClick={() => navigate('/admin')}
            style={{
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '1rem',
            }}
          >
            Назад в админку
          </button>
          <button 
            onClick={handleLogout}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        
        {/* Экспорт пользователей */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Пользователи</h2>
          <p>Экспорт списка всех пользователей системы</p>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleExport('users', 'csv')}
              disabled={loading.users_csv}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.users_csv ? 'not-allowed' : 'pointer',
                opacity: loading.users_csv ? 0.7 : 1,
              }}
            >
              {loading.users_csv ? 'Экспорт...' : 'Экспорт в CSV'}
            </button>
            
            <button 
              onClick={() => handleExport('users', 'excel')}
              disabled={loading.users_excel}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.users_excel ? 'not-allowed' : 'pointer',
                opacity: loading.users_excel ? 0.7 : 1,
              }}
            >
              {loading.users_excel ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        {/* Экспорт туров */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Туры</h2>
          <p>Экспорт списка всех туров</p>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleExport('tours', 'csv')}
              disabled={loading.tours_csv}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.tours_csv ? 'not-allowed' : 'pointer',
                opacity: loading.tours_csv ? 0.7 : 1,
              }}
            >
              {loading.tours_csv ? 'Экспорт...' : 'Экспорт в CSV'}
            </button>
            
            <button 
              onClick={() => handleExport('tours', 'excel')}
              disabled={loading.tours_excel}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.tours_excel ? 'not-allowed' : 'pointer',
                opacity: loading.tours_excel ? 0.7 : 1,
              }}
            >
              {loading.tours_excel ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        {/* Экспорт бронирований */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Бронирования</h2>
          <p>Экспорт списка всех бронирований</p>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleExport('bookings', 'csv')}
              disabled={loading.bookings_csv}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.bookings_csv ? 'not-allowed' : 'pointer',
                opacity: loading.bookings_csv ? 0.7 : 1,
              }}
            >
              {loading.bookings_csv ? 'Экспорт...' : 'Экспорт в CSV'}
            </button>
            
            <button 
              onClick={() => handleExport('bookings', 'excel')}
              disabled={loading.bookings_excel}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.bookings_excel ? 'not-allowed' : 'pointer',
                opacity: loading.bookings_excel ? 0.7 : 1,
              }}
            >
              {loading.bookings_excel ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        {/* Экспорт отзывов */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>Отзывы</h2>
          <p>Экспорт списка всех отзывов</p>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleExport('reviews', 'csv')}
              disabled={loading.reviews_csv}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.reviews_csv ? 'not-allowed' : 'pointer',
                opacity: loading.reviews_csv ? 0.7 : 1,
              }}
            >
              {loading.reviews_csv ? 'Экспорт...' : 'Экспорт в CSV'}
            </button>
            
            <button 
              onClick={() => handleExport('reviews', 'excel')}
              disabled={loading.reviews_excel}
              style={{
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading.reviews_excel ? 'not-allowed' : 'pointer',
                opacity: loading.reviews_excel ? 0.7 : 1,
              }}
            >
              {loading.reviews_excel ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Информация о форматах */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        marginTop: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2>Информация о форматах</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3>CSV (Comma-Separated Values)</h3>
            <ul>
              <li>Простой текстовый формат</li>
              <li>Открывается в Excel, Google Sheets</li>
              <li>Маленький размер файла</li>
              <li>Подходит для больших объемов данных</li>
            </ul>
          </div>
          <div>
            <h3>Excel (XLSX)</h3>
            <ul>
              <li>Формат Microsoft Excel</li>
              <li>Поддержка форматирования</li>
              <li>Встроенные формулы и диаграммы</li>
              <li>Более удобный для анализа</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
