import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationsContext';

const Header = () => {
  const navigate = useNavigate();
  const { currentUser, loading, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const isAuthenticated = Boolean(currentUser);
  const role = currentUser?.role || null;

  const publicLinks = [
    { to: '/', label: 'Главная' },
    { to: '/tours', label: 'Туры' },
    { to: '/tour-constructor', label: 'Конструктор' },
    { to: '/events', label: 'Мероприятия' },
    { to: '/about', label: 'О нас' },
  ];

  const staffLinks = [];

  if (isAuthenticated && ['admin', 'manager', 'analyst'].includes(role)) {
    staffLinks.push({ to: '/admin', label: 'Админка' });
  }

  const allLinks = [...publicLinks, ...staffLinks];

  const nameInitials = `${currentUser?.first_name?.[0] || ''}${currentUser?.last_name?.[0] || ''}`.toUpperCase();
  const initials = (
    nameInitials.length >= 2
      ? nameInitials
      : (currentUser?.first_name || currentUser?.last_name || currentUser?.email || 'US').slice(0, 2).toUpperCase()
  );

  const displayName =
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.email ||
    'Пользователь';

  const avatarSrc = (() => {
    const raw = currentUser?.avatar_data;
    if (!raw) return '';
    if (String(raw).startsWith('data:')) return raw;
    return `data:${currentUser?.avatar_type || 'image/jpeg'};base64,${raw}`;
  })();

  const getRoleLabel = (userRole) => {
    switch (userRole) {
      case 'admin':
        return 'Администратор';
      case 'manager':
        return 'Менеджер';
      case 'analyst':
        return 'Аналитик';
      case 'client':
        return 'Клиент';
      default:
        return 'Пользователь';
    }
  };

  const handleProfileClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    navigate('/profile');
  };

  const handleFavoritesClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    navigate('/favorites');
  };

  const handleNotificationsClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    navigate('/notifications');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-brand">
          <span className="site-brand__mark">✦</span>
          <span className="site-brand__text">
            <span className="site-brand__name">Travel Agency</span>
            <span className="site-brand__sub">tourism intelligence platform</span>
          </span>
        </Link>

        <nav className="site-header-nav">
          {allLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `site-header-nav__link ${isActive ? 'site-header-nav__link--active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header-actions">
          {loading ? null : isAuthenticated ? (
            <>
              <button
                type="button"
                className="site-header-icon"
                onClick={handleFavoritesClick}
                aria-label="Избранное"
                title="Избранное"
              >
                <span>♡</span>
              </button>

              <button
                type="button"
                className="site-header-icon"
                onClick={handleNotificationsClick}
                aria-label="Уведомления"
                title="Уведомления"
              >
                <span>◔</span>
                {unreadCount > 0 && (
                  <span className="site-header-icon__badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="site-header-profile"
                onClick={handleProfileClick}
              >
                <span className="site-header-profile__avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={displayName} />
                  ) : (
                    initials
                  )}
                </span>
                <span className="site-header-profile__meta">
                  <strong>{displayName}</strong>
                  <small>{getRoleLabel(role)}</small>
                </span>
              </button>

              <button
                type="button"
                className="site-header-login"
                onClick={handleLogoutClick}
              >
                Выйти
              </button>
            </>
          ) : (
            <button
              type="button"
              className="site-header-login"
              onClick={handleLoginClick}
            >
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
