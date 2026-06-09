import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useNotifications } from '../components/NotificationsContext';

const normalizeErrorMessage = (detail) => {
  if (!detail) return 'Не удалось выполнить операцию';

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return 'Некорректные данные';
      })
      .join(', ');
  }

  if (typeof detail === 'object') {
    if (detail.msg) return detail.msg;
    if (detail.detail) return normalizeErrorMessage(detail.detail);
    return 'Некорректный ответ сервера';
  }

  return 'Не удалось выполнить операцию';
};

const normalizeNotificationsResponse = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
};

const normalizeNotificationType = (type) => {
  switch (type) {
    case 'success':
      return 'success';
    case 'danger':
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

const formatTypeLabel = (type) => {
  switch (type) {
    case 'success':
      return 'Успешно';
    case 'danger':
    case 'error':
      return 'Важно';
    case 'warning':
      return 'Предупреждение';
    default:
      return 'Информация';
  }
};

const formatDateTime = (value) => {
  if (!value) return 'Недавно';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Недавно';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Notifications = () => {
  const navigate = useNavigate();
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await tourismAPI.getNotifications();
      const normalized = normalizeNotificationsResponse(response?.data);

      setNotifications(normalized);
      await refreshUnreadCount(true);
    } catch (err) {
      console.error('Ошибка загрузки уведомлений:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setNotifications([]);
      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось загрузить уведомления'
      );
    } finally {
      setLoading(false);
    }
  }, [navigate, refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const isUnread = !item?.is_read;

      if (activeFilter === 'unread' && !isUnread) return false;
      if (activeFilter === 'read' && isUnread) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        item?.title,
        item?.message,
        item?.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [notifications, activeFilter, search]);

  const readCount = useMemo(() => {
    return notifications.filter((item) => item?.is_read).length;
  }, [notifications]);

  const totalCount = notifications.length;

  const handleOpenSettings = () => {
    navigate('/notifications/settings');
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      setActionLoadingId(notificationId);
      setError('');
      setSuccess('');

      await tourismAPI.markNotificationAsRead(notificationId);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                is_read: true,
                read_at: item.read_at || new Date().toISOString(),
              }
            : item
        )
      );

      await refreshUnreadCount(true);
    } catch (err) {
      console.error('Ошибка отметки уведомления как прочитанного:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось отметить уведомление как прочитанное'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      setError('');
      setSuccess('');

      await tourismAPI.markAllNotificationsAsRead();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );

      await refreshUnreadCount(true);
      setSuccess('Все уведомления отмечены как прочитанные');
    } catch (err) {
      console.error('Ошибка отметки всех уведомлений как прочитанных:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось отметить все уведомления как прочитанные'
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      setActionLoadingId(notificationId);
      setError('');
      setSuccess('');

      await tourismAPI.deleteNotification(notificationId);

      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      await refreshUnreadCount(true);
    } catch (err) {
      console.error('Ошибка удаления уведомления:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось удалить уведомление'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell notifications-page">
        <div className="home-empty">Загрузка уведомлений...</div>
      </div>
    );
  }

  return (
    <div className="page-shell notifications-page">
      <section className="notifications-hero">
        <div>
          <span className="home-hero__eyebrow">Центр уведомлений</span>
          <h1 className="notifications-hero__title">Уведомления</h1>
          <p className="notifications-hero__text">
            Следите за изменениями статусов бронирований, новостями и важными событиями.
          </p>
        </div>

        <div className="notifications-hero__stats">
          <div className="compact-stat">
            <span>Всего</span>
            <strong>{totalCount}</strong>
          </div>

          <div className="compact-stat">
            <span>Непрочитано</span>
            <strong>{unreadCount}</strong>
          </div>

          <div className="compact-stat">
            <span>Прочитано</span>
            <strong>{readCount}</strong>
          </div>
        </div>
      </section>

      {error && <div className="detail-alert detail-alert--error">{error}</div>}
      {success && <div className="detail-alert detail-alert--success">{success}</div>}

      <section className="notifications-toolbar">
        <div className="notifications-toolbar__left">
          <button
            type="button"
            className={`notifications-filter-chip ${
              activeFilter === 'all' ? 'notifications-filter-chip--active' : ''
            }`}
            onClick={() => setActiveFilter('all')}
          >
            Все
          </button>

          <button
            type="button"
            className={`notifications-filter-chip ${
              activeFilter === 'unread' ? 'notifications-filter-chip--active' : ''
            }`}
            onClick={() => setActiveFilter('unread')}
          >
            Непрочитанные
            {unreadCount > 0 && (
              <span className="notifications-filter-chip__badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`notifications-filter-chip ${
              activeFilter === 'read' ? 'notifications-filter-chip--active' : ''
            }`}
            onClick={() => setActiveFilter('read')}
          >
            Прочитанные
          </button>
        </div>

        <div className="notifications-toolbar__right">
          <input
            type="text"
            className="notifications-search"
            placeholder="Поиск по уведомлениям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={handleOpenSettings}
          >
            Настройки
          </button>

          <button
            type="button"
            className="site-button site-button--primary"
            onClick={handleMarkAllAsRead}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? 'Обработка...' : 'Прочитать все'}
          </button>
        </div>
      </section>

      {filteredNotifications.length === 0 ? (
        <div className="notifications-empty">
          <div className="notifications-empty__inner">
            <div className="notifications-empty__icon">◔</div>
            <h2>Уведомлений не найдено</h2>
            <p>
              Здесь будут отображаться важные события, изменения по бронированиям
              и сервисные сообщения.
            </p>
          </div>
        </div>
      ) : (
        <section className="notifications-list">
          {filteredNotifications.map((notification) => {
            const typeClass = normalizeNotificationType(notification?.type);

            return (
              <article
                key={notification.id}
                className={`notification-card ${
                  !notification?.is_read ? 'notification-card--unread' : ''
                }`}
              >
                <div className="notification-card__icon">
                  {typeClass === 'success'
                    ? '✓'
                    : typeClass === 'danger'
                    ? '!'
                    : typeClass === 'warning'
                    ? '•'
                    : 'i'}
                </div>

                <div className="notification-card__content">
                  <div className="notification-card__top">
                    <div className="notification-card__head">
                      <div className="notification-card__chips">
                        <span className={`ui-chip ui-chip--${typeClass}`}>
                          {formatTypeLabel(notification?.type)}
                        </span>

                        {!notification?.is_read && (
                          <span className="ui-chip ui-chip--accent">Новое</span>
                        )}
                      </div>

                      <h3 className="notification-card__title">
                        {notification?.title || 'Уведомление'}
                      </h3>
                    </div>

                    <span className="notification-card__time">
                      {formatDateTime(notification?.created_at)}
                    </span>
                  </div>

                  <p className="notification-card__message">
                    {notification?.message || 'Сообщение отсутствует'}
                  </p>

                  <div className="notification-card__footer">
                    <div className="notification-card__meta">
                      {notification?.is_read
                        ? `Прочитано: ${formatDateTime(notification?.read_at)}`
                        : 'Ещё не прочитано'}
                    </div>

                    <div className="notification-card__actions">
                      {!notification?.is_read && (
                        <button
                          type="button"
                          className="site-button site-button--secondary"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={actionLoadingId === notification.id}
                        >
                          {actionLoadingId === notification.id
                            ? 'Обработка...'
                            : 'Отметить прочитанным'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="site-button site-button--danger"
                        onClick={() => handleDeleteNotification(notification.id)}
                        disabled={actionLoadingId === notification.id}
                      >
                        {actionLoadingId === notification.id
                          ? 'Удаление...'
                          : 'Удалить'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default Notifications;