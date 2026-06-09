import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tourismAPI } from '../services/api';

const ROLE_OPTIONS = [
  { value: 'client', label: 'Клиент' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'analyst', label: 'Аналитик' },
  { value: 'admin', label: 'Администратор' },
];

const AdminUsers = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    verified: 'all',
  });

  const [editingUserId, setEditingUserId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('client');

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const [meResponse, usersResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getAllUsers(),
      ]);

      const me = meResponse.data;
      if (me.role !== 'admin') {
        navigate('/profile');
        return;
      }

      setCurrentUser(me);
      setUsers(usersResponse.data || []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (err.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setError('Не удалось загрузить список пользователей');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      clients: users.filter((u) => u.role === 'client').length,
      managers: users.filter((u) => u.role === 'manager').length,
      analysts: users.filter((u) => u.role === 'analyst').length,
      admins: users.filter((u) => u.role === 'admin').length,
      verified: users.filter((u) => u.is_verified).length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (filters.role !== 'all') {
      result = result.filter((user) => user.role === filters.role);
    }

    if (filters.verified !== 'all') {
      result = result.filter((user) =>
        filters.verified === 'verified' ? user.is_verified : !user.is_verified
      );
    }

    if (filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();

      result = result.filter((user) => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

        return (
          String(user.id).includes(term) ||
          (user.email || '').toLowerCase().includes(term) ||
          (user.phone || '').toLowerCase().includes(term) ||
          fullName.toLowerCase().includes(term)
        );
      });
    }

    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [users, filters]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU');
  };

  const getFullName = (user) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || 'Имя не указано';
  };

  const getRoleLabel = (role) => {
    const roleOption = ROLE_OPTIONS.find((item) => item.value === role);
    return roleOption ? roleOption.label : role;
  };

  const getRoleClass = (role) => {
    switch (role) {
      case 'admin':
        return 'admin-role-badge admin-role-badge--admin';
      case 'manager':
        return 'admin-role-badge admin-role-badge--manager';
      case 'analyst':
        return 'admin-role-badge admin-role-badge--analyst';
      default:
        return 'admin-role-badge admin-role-badge--client';
    }
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setRoleDraft(user.role || 'client');
    setError('');
    setSuccessMessage('');
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setRoleDraft('client');
  };

  const saveRole = async (userId) => {
    try {
      setError('');
      setSuccessMessage('');

      await api.patch(`/users/${userId}/role`, {
        role: roleDraft,
      });

      setSuccessMessage(`Роль пользователя #${userId} успешно обновлена`);
      cancelEditing();
      await loadPage();
    } catch (err) {
      console.error('Ошибка обновления роли:', err);
      setError(err.response?.data?.detail || 'Не удалось обновить роль пользователя');
    }
  };

  if (loading) {
    return (
      <div className="page-shell admin-users-page">
        <div className="home-empty">Загрузка пользователей...</div>
      </div>
    );
  }

  return (
    <div className="page-shell admin-users-page">
      <section className="admin-users-hero">
        <div>
          <span className="home-hero__eyebrow">CRM / Пользователи</span>
          <h1 className="admin-users-hero__title">Управление пользователями</h1>
          <p className="admin-users-hero__text">
            Просматривайте аккаунты, фильтруйте пользователей по ролям и меняйте
            права доступа из единой административной панели.
          </p>
        </div>

        <div className="admin-users-hero__side">
          <div className="admin-users-chip">
            <span>Администратор</span>
            <strong>{currentUser?.first_name || 'Admin'}</strong>
          </div>
          <div className="admin-users-chip">
            <span>Всего аккаунтов</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
      </section>

      <section className="admin-users-stats">
        <StatCard title="Всего" value={stats.total} />
        <StatCard title="Клиенты" value={stats.clients} />
        <StatCard title="Менеджеры" value={stats.managers} />
        <StatCard title="Аналитики" value={stats.analysts} />
        <StatCard title="Админы" value={stats.admins} />
        <StatCard title="Подтверждены" value={stats.verified} />
      </section>

      <section className="admin-users-toolbar">
        <div className="admin-users-filters">
          <input
            type="text"
            placeholder="Поиск по ID, имени, email, телефону..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="admin-users-input"
          />

          <select
            value={filters.role}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, role: e.target.value }))
            }
            className="admin-users-select"
          >
            <option value="all">Все роли</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            value={filters.verified}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, verified: e.target.value }))
            }
            className="admin-users-select"
          >
            <option value="all">Любой статус</option>
            <option value="verified">Подтверждённые</option>
            <option value="unverified">Неподтверждённые</option>
          </select>
        </div>

        <div className="admin-users-toolbar__actions">
          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={loadPage}
          >
            Обновить
          </button>

          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={() => navigate('/admin')}
          >
            Назад
          </button>
        </div>
      </section>

      {error && (
        <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="detail-alert detail-alert--success" style={{ marginBottom: '18px' }}>
          {successMessage}
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <div className="home-empty">Пользователи не найдены</div>
      ) : (
        <div className="admin-users-list">
          {filteredUsers.map((user) => {
            const isEditing = editingUserId === user.id;

            return (
              <article key={user.id} className="admin-user-card">
                <div className="admin-user-card__head">
                  <div>
                    <h2 className="admin-user-card__title">
                      {getFullName(user)}
                    </h2>
                    <p className="admin-user-card__subtitle">
                      ID #{user.id} · {user.email}
                    </p>
                  </div>

                  <div className="admin-user-card__badges">
                    <span className={getRoleClass(user.role)}>
                      {getRoleLabel(user.role)}
                    </span>

                    <span
                      className={`admin-verify-badge ${
                        user.is_verified
                          ? 'admin-verify-badge--verified'
                          : 'admin-verify-badge--unverified'
                      }`}
                    >
                      {user.is_verified ? 'Подтверждён' : 'Не подтверждён'}
                    </span>
                  </div>
                </div>

                <div className="admin-user-card__grid">
                  <div className="admin-user-card__item">
                    <span>Email</span>
                    <strong>{user.email}</strong>
                  </div>

                  <div className="admin-user-card__item">
                    <span>Телефон</span>
                    <strong>{user.phone || 'Не указан'}</strong>
                  </div>

                  <div className="admin-user-card__item">
                    <span>Имя</span>
                    <strong>{user.first_name || '—'}</strong>
                  </div>

                  <div className="admin-user-card__item">
                    <span>Фамилия</span>
                    <strong>{user.last_name || '—'}</strong>
                  </div>

                  <div className="admin-user-card__item">
                    <span>Роль</span>
                    <strong>{getRoleLabel(user.role)}</strong>
                  </div>

                  <div className="admin-user-card__item">
                    <span>Регистрация</span>
                    <strong>{formatDate(user.created_at)}</strong>
                  </div>
                </div>

                <div className="admin-user-card__footer">
                  {!isEditing ? (
                    <div className="admin-user-card__actions">
                      <button
                        type="button"
                        className="site-button site-button--primary"
                        onClick={() => startEditing(user)}
                      >
                        Изменить роль
                      </button>

                      <a
                        href={`mailto:${user.email}`}
                        className="site-button site-button--secondary"
                      >
                        Написать
                      </a>
                    </div>
                  ) : (
                    <div className="admin-user-editor">
                      <div className="admin-user-editor__fields">
                        <select
                          value={roleDraft}
                          onChange={(e) => setRoleDraft(e.target.value)}
                          className="admin-users-select"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="admin-user-editor__actions">
                        <button
                          type="button"
                          className="site-button site-button--primary"
                          onClick={() => saveRole(user.id)}
                        >
                          Сохранить
                        </button>

                        <button
                          type="button"
                          className="site-button site-button--secondary"
                          onClick={cancelEditing}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value }) => (
  <div className="admin-users-stat">
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
);

export default AdminUsers;