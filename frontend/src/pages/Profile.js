import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useAuth } from '../components/AuthContext';

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, logout, setCurrentUser } = useAuth();

  const [profile, setProfile] = useState(user || null);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const syncProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setCurrentUser(nextProfile);
    setForm({
      first_name: nextProfile?.first_name || '',
      last_name: nextProfile?.last_name || '',
      phone: nextProfile?.phone || '',
      email: nextProfile?.email || '',
    });
  }, [setCurrentUser]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [userResponse, bookingsResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getBookings(),
      ]);

      const currentUser = userResponse.data;
      const allBookings = bookingsResponse.data || [];

      syncProfile(currentUser);
      setBookings(allBookings.filter((item) => item.user_id === currentUser.id));
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err);

      if (err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError('Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, [logout, navigate, syncProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const profileStats = useMemo(() => {
    const total = bookings.length;
    const active = bookings.filter((b) => ['pending', 'confirmed'].includes(b.status)).length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const totalSpent = bookings
      .filter((b) => ['confirmed', 'completed'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.total_price || 0), 0);

    return { total, active, completed, totalSpent };
  }, [bookings]);

  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.booking_date || b.created_at) - new Date(a.booking_date || a.created_at))
      .slice(0, 4);
  }, [bookings]);

  const initials = useMemo(() => {
    if (!profile) return 'US';
    const nameInitials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
    if (nameInitials.length >= 2) return nameInitials;
    return (profile.first_name || profile.last_name || profile.email || 'US').slice(0, 2).toUpperCase();
  }, [profile]);

  const avatarSrc = useMemo(() => {
    const raw = profile?.avatar_data;
    if (!raw) return '';
    if (String(raw).startsWith('data:')) return raw;
    return `data:${profile?.avatar_type || 'image/jpeg'};base64,${raw}`;
  }, [profile]);

  const fullName = useMemo(() => {
    if (!profile) return 'Пользователь';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email;
  }, [profile]);

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'manager': return 'Менеджер';
      case 'analyst': return 'Аналитик';
      default: return 'Клиент';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Ожидание';
      case 'confirmed': return 'Подтверждено';
      case 'cancelled': return 'Отменено';
      case 'completed': return 'Завершено';
      default: return status || '—';
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  const togglePersonalInfo = () => {
    setIsPersonalInfoOpen((prev) => {
      const next = !prev;
      if (!next) {
        setIsProfileEditorOpen(false);
      }
      return next;
    });
  };

  const openProfileEditor = () => {
    setIsPersonalInfoOpen(true);
    setIsProfileEditorOpen(true);
    setMessage('');
    setError('');
  };

  const closeProfileEditor = () => {
    setIsProfileEditorOpen(false);
    setForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
    });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      setError('');
      const response = await tourismAPI.updateCurrentUser({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      syncProfile(response.data);
      setIsProfileEditorOpen(false);
      setMessage('Личная информация обновлена');
    } catch (err) {
      console.error('Ошибка сохранения профиля:', err);
      setError(err?.response?.data?.detail || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение в формате JPG, PNG или WebP');
      return;
    }

    if (file.size > 1.8 * 1024 * 1024) {
      setError('Размер аватарки должен быть меньше 1.8 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const avatarData = String(reader.result || '');
      if (!avatarData.startsWith('data:image/')) {
        setError('Файл изображения прочитан некорректно');
        return;
      }

      try {
        setAvatarSaving(true);
        setMessage('');
        setError('');

        // Мгновенно показываем выбранную аватарку в интерфейсе,
        // а затем сохраняем её на сервере через отдельный endpoint.
        const optimisticProfile = {
          ...(profile || {}),
          avatar_data: avatarData,
          avatar_type: file.type,
        };
        syncProfile(optimisticProfile);

        const response = await tourismAPI.updateCurrentUserAvatar({
          avatar_data: avatarData,
          avatar_type: file.type,
        });

        const savedProfile = response?.data || optimisticProfile;
        if (!savedProfile?.avatar_data) {
          throw new Error('Сервер не вернул сохранённую аватарку. Перезапустите backend и попробуйте снова.');
        }

        syncProfile(savedProfile);
        setMessage('Аватарка обновлена');
      } catch (err) {
        console.error('Ошибка загрузки аватарки:', err);
        await loadProfile();
        setError(err?.response?.data?.detail || err?.message || 'Не удалось обновить аватарку');
      } finally {
        setAvatarSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setError('Не удалось прочитать файл изображения');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarSaving(true);
      setMessage('');
      setError('');
      const response = await tourismAPI.deleteCurrentUserAvatar();
      syncProfile(response.data);
      setMessage('Аватарка удалена');
    } catch (err) {
      console.error('Ошибка удаления аватарки:', err);
      await loadProfile();
      setError(err?.response?.data?.detail || 'Не удалось удалить аватарку');
    } finally {
      setAvatarSaving(false);
    }
  };

  if (loading) {
    return <div className="page-shell profile-page"><div className="home-empty">Загрузка профиля...</div></div>;
  }

  if (error && !profile) {
    return <div className="page-shell profile-page"><div className="home-empty profile-message profile-message--error">{error}</div></div>;
  }

  return (
    <div className="page-shell profile-page profile-page--client-only">
      <section className="profile-hero profile-hero--clean profile-hero--focused">
        <div className="profile-hero__main">
          <div className="profile-avatar profile-avatar--editable profile-avatar--hero">
            {avatarSrc ? <img src={avatarSrc} alt={fullName} /> : <span>{initials}</span>}
          </div>

          <div className="profile-hero__info">
            <span className="home-hero__eyebrow">Личный кабинет</span>
            <h1 className="profile-hero__title">{fullName}</h1>
            <p className="profile-hero__subtitle">{profile.email} · {getRoleLabel(profile.role)}</p>
            <p className="profile-hero__text">
              Здесь собраны ваши бронирования, избранные туры, уведомления и личные настройки.
              Рабочие разделы сотрудников находятся отдельно — в админке.
            </p>
            <button
              type="button"
              className="site-button site-button--midnight site-button--small profile-hero__personal-button"
              onClick={togglePersonalInfo}
            >
              {isPersonalInfoOpen ? 'Скрыть личную информацию' : 'Личная информация'}
            </button>
          </div>
        </div>
      </section>

      <section className={`profile-panel profile-personal-card ${isPersonalInfoOpen ? 'profile-personal-card--open' : ''}`}>
        <button
          type="button"
          className="profile-personal-card__toggle"
          onClick={togglePersonalInfo}
          aria-expanded={isPersonalInfoOpen}
        >
          <span className="profile-personal-card__badge">Личная информация</span>
          <span className="profile-personal-card__title">Контакты, аватарка и данные профиля</span>
          <span className="profile-personal-card__hint">
            {isPersonalInfoOpen ? 'Скрыть раздел' : 'Раздел свёрнут, чтобы не занимать рабочее пространство'}
          </span>
          <strong>{isPersonalInfoOpen ? '−' : '+'}</strong>
        </button>

        {isPersonalInfoOpen && (
          <div className="profile-personal-card__body">
            <div className="profile-personal-grid">
              <div className="profile-avatar-manager">
                <div className="profile-avatar profile-avatar--editable profile-avatar--manager">
                  {avatarSrc ? <img src={avatarSrc} alt={fullName} /> : <span>{initials}</span>}
                </div>
                <div>
                  <h3>Аватарка профиля</h3>
                  <p>
                    Загрузите фотографию или логотип. Если изображения нет, система покажет две буквы
                    на градиентном фоне.
                  </p>
                  <div className="profile-avatar-manager__actions">
                    <button type="button" className="site-button site-button--primary" onClick={() => fileInputRef.current?.click()} disabled={avatarSaving}>
                      {profile?.avatar_data ? 'Изменить аватарку' : 'Загрузить аватарку'}
                    </button>
                    {profile?.avatar_data && (
                      <button type="button" className="site-button site-button--secondary" onClick={handleRemoveAvatar} disabled={avatarSaving}>
                        Удалить
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} className="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarFile} />
                  {message && <div className="profile-message profile-message--success">{message}</div>}
                  {error && <div className="profile-message profile-message--error">{error}</div>}
                </div>
              </div>

              <div className="profile-info-grid">
                <div className="profile-mini-card"><span>Дата регистрации</span><strong>{formatDate(profile.created_at)}</strong></div>
                <div className="profile-mini-card"><span>Телефон</span><strong>{profile.phone || 'Не указан'}</strong></div>
                <div className="profile-mini-card"><span>Email</span><strong>{profile.email}</strong></div>
                <div className="profile-mini-card"><span>Email подтвержден</span><strong>{profile.is_verified ? 'Да' : 'Нет'}</strong></div>
              </div>
            </div>

            <div className="profile-personal-actions">
              <button
                type="button"
                className="site-button site-button--midnight"
                onClick={openProfileEditor}
              >
                Редактировать
              </button>
              <span>Форма редактирования открывается только по кнопке, чтобы не занимать место в кабинете.</span>
            </div>

            {isProfileEditorOpen && (
              <form className="profile-edit-form profile-edit-form--compact" onSubmit={handleSaveProfile}>
                <div className="profile-panel__head profile-panel__head--compact">
                  <div>
                    <span className="home-hero__eyebrow">Редактирование</span>
                    <h2>Основные данные</h2>
                  </div>
                  <div className="profile-edit-form__actions">
                    <button type="button" className="site-button site-button--secondary" onClick={closeProfileEditor} disabled={saving}>
                      Отмена
                    </button>
                    <button type="submit" className="site-button site-button--primary" disabled={saving}>
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>

                <div className="profile-form-grid">
                  <label className="profile-field"><span>Имя</span><input name="first_name" value={form.first_name} onChange={handleFormChange} placeholder="Например, Даниил" /></label>
                  <label className="profile-field"><span>Фамилия</span><input name="last_name" value={form.last_name} onChange={handleFormChange} placeholder="Например, Волков" /></label>
                  <label className="profile-field"><span>Email</span><input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="email@example.com" /></label>
                  <label className="profile-field"><span>Телефон</span><input name="phone" value={form.phone} onChange={handleFormChange} placeholder="+7 999 000-00-00" /></label>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="profile-stats profile-stats--client">
        <div className="profile-stat-card"><span>Всего бронирований</span><strong>{profileStats.total}</strong></div>
        <div className="profile-stat-card"><span>Активные заявки</span><strong>{profileStats.active}</strong></div>
        <div className="profile-stat-card"><span>Завершённые поездки</span><strong>{profileStats.completed}</strong></div>
        <div className="profile-stat-card"><span>Оплачено поездок</span><strong>{formatMoney(profileStats.totalSpent)}</strong></div>
      </section>

      <section className="profile-layout profile-layout--balanced profile-layout--without-editor">
        <div className="profile-main">
          <div className="profile-panel profile-panel--midnight-accent">
            <div className="profile-panel__head">
              <div>
                <span className="home-hero__eyebrow">Быстрый доступ</span>
                <h2>Ваши разделы</h2>
              </div>
            </div>

            <div className="profile-actions-grid profile-actions-grid--client">
              <Link to="/my-bookings" className="profile-action-card"><div className="profile-action-card__icon">🧾</div><h3>Мои бронирования</h3><p>Заявки, количество туристов, стоимость и текущий статус.</p></Link>
              <Link to="/favorites" className="profile-action-card"><div className="profile-action-card__icon">♡</div><h3>Избранное</h3><p>Туры, которые вы сохранили для сравнения и выбора.</p></Link>
              <Link to="/notifications" className="profile-action-card"><div className="profile-action-card__icon">🔔</div><h3>Уведомления</h3><p>Подтверждения заявок, изменения статусов и важные события.</p></Link>
              <Link to="/notifications/settings" className="profile-action-card"><div className="profile-action-card__icon">⚙</div><h3>Настройки</h3><p>Управление уведомлениями и важными сообщениями.</p></Link>
            </div>
          </div>
        </div>

        <aside className="profile-sidebar">
          <div className="profile-panel profile-panel--bookings">
            <div className="profile-panel__head"><h2>Последние бронирования</h2></div>
            {recentBookings.length === 0 ? (
              <div className="profile-empty-state"><strong>Бронирований пока нет</strong><span>Выберите тур и оформите заявку — она появится здесь.</span></div>
            ) : (
              <div className="profile-bookings-list">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="profile-booking-card">
                    <div className="profile-booking-card__top"><strong>Заявка #{booking.id}</strong><span className={`profile-status profile-status--${booking.status || 'pending'}`}>{getStatusLabel(booking.status)}</span></div>
                    <div className="profile-booking-card__meta"><span>Тур ID: {booking.tour_id}</span><span>{booking.people_count} чел.</span></div>
                    <div className="profile-booking-card__meta"><span>{formatMoney(booking.total_price)}</span><span>{formatDate(booking.booking_date)}</span></div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/my-bookings" className="site-button site-button--secondary profile-wide-button">Смотреть все бронирования</Link>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default Profile;
