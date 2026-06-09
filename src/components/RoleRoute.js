import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const RoleRoute = ({ allowedRoles = [], children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-shell" style={{ padding: '40px 0' }}>
        <div className="home-empty">Проверка роли пользователя...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    if (currentUser.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/profile" replace />;
  }

  return children;
};

export default RoleRoute;