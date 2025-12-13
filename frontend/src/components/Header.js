import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFavorites } from './FavoritesContext'; // Добавим

const Header = () => {
  const navigate = useNavigate();
  const { favoritesCount } = useFavorites(); // Добавим
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    setIsLoggedIn(!!token);
    setUserRole(role);
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserRole(null);
    navigate('/login');
  };

  return (
    <header style={{
      backgroundColor: '#2c3e50',
      color: 'white',
      padding: '1rem 0',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link to="/" style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: 'white',
          textDecoration: 'none',
        }}>Travel Agency</Link>
        <nav>
          <ul style={{
            display: 'flex',
            listStyle: 'none',
          }}>
            <li><Link to="/" style={{
              color: 'white',
              textDecoration: 'none',
              marginLeft: '2rem',
              transition: 'color 0.3s',
            }}>Главная</Link></li>
            <li><Link to="/tours" style={{
              color: 'white',
              textDecoration: 'none',
              marginLeft: '2rem',
              transition: 'color 0.3s',
            }}>Туры</Link></li>
            {/* Добавим ссылку на избранное */}
            <li>
              <Link to="/favorites" style={{
                color: 'white',
                textDecoration: 'none',
                marginLeft: '2rem',
                transition: 'color 0.3s',
                position: 'relative',
              }}>
                Избранное
                {favoritesCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {favoritesCount}
                  </span>
                )}
              </Link>
            </li>
            {isLoggedIn ? (
              <>
                <li><Link to="/profile" style={{
                  color: 'white',
                  textDecoration: 'none',
                  marginLeft: '2rem',
                  transition: 'color 0.3s',
                }}>Профиль</Link></li>
                {userRole === 'admin' && (
                  <li><Link to="/admin" style={{
                    color: 'white',
                    textDecoration: 'none',
                    marginLeft: '2rem',
                    transition: 'color 0.3s',
                  }}>Админ</Link></li>
                )}
                <li><button onClick={handleLogout} style={{
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: 'none',
                  marginLeft: '2rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}>Выйти</button></li>
              </>
            ) : (
              <>
                <li><Link to="/login" style={{
                  color: 'white',
                  textDecoration: 'none',
                  marginLeft: '2rem',
                  transition: 'color 0.3s',
                }}>Вход</Link></li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
