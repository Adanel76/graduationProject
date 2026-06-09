import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const DEFAULT_SETTINGS = {
  email_booking_confirmation: true,
  email_booking_updates: true,
  email_newsletter: false,
  email_promotions: false,
};

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

const normalizeSettings = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return DEFAULT_SETTINGS;
  }

  return {
    email_booking_confirmation:
      typeof payload.email_booking_confirmation === 'boolean'
        ? payload.email_booking_confirmation
        : DEFAULT_SETTINGS.email_booking_confirmation,

    email_booking_updates:
      typeof payload.email_booking_updates === 'boolean'
        ? payload.email_booking_updates
        : DEFAULT_SETTINGS.email_booking_updates,

    email_newsletter:
      typeof payload.email_newsletter === 'boolean'
        ? payload.email_newsletter
        : DEFAULT_SETTINGS.email_newsletter,

    email_promotions:
      typeof payload.email_promotions === 'boolean'
        ? payload.email_promotions
        : DEFAULT_SETTINGS.email_promotions,
  };
};

const NotificationSettings = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await tourismAPI.getNotificationSettings();
      const normalized = normalizeSettings(response?.data);

      setSettings(normalized);
      setInitialSettings(normalized);
    } catch (err) {
      console.error('Ошибка загрузки настроек уведомлений:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось загрузить настройки уведомлений'
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  const enabledCount = useMemo(() => {
    return Object.values(settings).filter(Boolean).length;
  }, [settings]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSuccess('');
    if (error) setError('');
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setSuccess('');
    setError('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = {
        email_booking_confirmation: settings.email_booking_confirmation,
        email_booking_updates: settings.email_booking_updates,
        email_newsletter: settings.email_newsletter,
        email_promotions: settings.email_promotions,
      };

      const response = await tourismAPI.updateNotificationSettings(payload);
      const normalized = normalizeSettings(response?.data || payload);

      setSettings(normalized);
      setInitialSettings(normalized);
      setSuccess('Настройки уведомлений сохранены');
    } catch (err) {
      console.error('Ошибка сохранения настроек уведомлений:', err);

      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }

      setError(
        normalizeErrorMessage(err?.response?.data?.detail) ||
          'Не удалось сохранить настройки'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell notification-settings-page">
        <div className="home-empty">Загрузка настроек уведомлений...</div>
      </div>
    );
  }

  return (
    <div className="page-shell notification-settings-page">
      <section className="notification-settings-hero">
        <div>
          <span className="home-hero__eyebrow">Настройки уведомлений</span>
          <h1 className="notification-settings-hero__title">Управление уведомлениями</h1>
          <p className="notification-settings-hero__text">
            Выберите, какие письма и уведомления вы хотите получать от системы.
          </p>
        </div>

        <div className="notification-settings-hero__stats">
          <div className="compact-stat">
            <span>Активно</span>
            <strong>{enabledCount}</strong>
          </div>

          <div className="compact-stat">
            <span>Всего каналов</span>
            <strong>4</strong>
          </div>
        </div>
      </section>

      {error && <div className="detail-alert detail-alert--error">{error}</div>}
      {success && <div className="detail-alert detail-alert--success">{success}</div>}

      <section className="notification-settings-grid">
        <article className="notification-settings-card">
          <div className="notification-settings-card__head">
            <span className="home-hero__eyebrow">Бронирования</span>
            <h2>Основные уведомления</h2>
            <p>Самые важные сообщения по вашим заявкам и изменениям статусов.</p>
          </div>

          <div className="notification-settings-list">
            <div className="notification-setting-row">
              <div className="notification-setting-row__content">
                <strong>Подтверждение бронирования</strong>
                <p>Письмо после создания новой заявки или бронирования тура.</p>
              </div>

              <button
                type="button"
                className={`notification-toggle ${
                  settings.email_booking_confirmation ? 'notification-toggle--active' : ''
                }`}
                onClick={() => handleToggle('email_booking_confirmation')}
                aria-label="Переключить подтверждение бронирования"
              >
                <span className="notification-toggle__thumb" />
              </button>
            </div>

            <div className="notification-setting-row">
              <div className="notification-setting-row__content">
                <strong>Обновления по бронированиям</strong>
                <p>Изменение статуса заявки, перенос, подтверждение или отмена.</p>
              </div>

              <button
                type="button"
                className={`notification-toggle ${
                  settings.email_booking_updates ? 'notification-toggle--active' : ''
                }`}
                onClick={() => handleToggle('email_booking_updates')}
                aria-label="Переключить обновления бронирований"
              >
                <span className="notification-toggle__thumb" />
              </button>
            </div>
          </div>
        </article>

        <article className="notification-settings-card">
          <div className="notification-settings-card__head">
            <span className="home-hero__eyebrow">Контент и маркетинг</span>
            <h2>Дополнительные уведомления</h2>
            <p>Информационные и промо-сообщения, которые не влияют на ваши заявки.</p>
          </div>

          <div className="notification-settings-list">
            <div className="notification-setting-row">
              <div className="notification-setting-row__content">
                <strong>Новостная рассылка</strong>
                <p>Новости агентства, статьи, подборки направлений и обновления сервиса.</p>
              </div>

              <button
                type="button"
                className={`notification-toggle ${
                  settings.email_newsletter ? 'notification-toggle--active' : ''
                }`}
                onClick={() => handleToggle('email_newsletter')}
                aria-label="Переключить новостную рассылку"
              >
                <span className="notification-toggle__thumb" />
              </button>
            </div>

            <div className="notification-setting-row">
              <div className="notification-setting-row__content">
                <strong>Акции и специальные предложения</strong>
                <p>Промокоды, скидки, подборки сезонов и специальные предложения.</p>
              </div>

              <button
                type="button"
                className={`notification-toggle ${
                  settings.email_promotions ? 'notification-toggle--active' : ''
                }`}
                onClick={() => handleToggle('email_promotions')}
                aria-label="Переключить промо-уведомления"
              >
                <span className="notification-toggle__thumb" />
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="notification-settings-footer">
        <div className="notification-settings-footer__note">
          Изменения вступают в силу сразу после сохранения. Системные уведомления,
          критичные для безопасности аккаунта, могут отправляться независимо от этих настроек.
        </div>

        <div className="notification-settings-footer__actions">
          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={handleReset}
            disabled={!isDirty || saving}
          >
            Сбросить изменения
          </button>

          <button
            type="button"
            className="site-button site-button--primary"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default NotificationSettings;