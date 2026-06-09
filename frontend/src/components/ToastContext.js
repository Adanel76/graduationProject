import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

let toastCounter = 0;

const normalizeToastText = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => normalizeToastText(item))
      .filter(Boolean);
    return messages.join('. ') || fallback;
  }

  if (typeof value === 'object') {
    if (value.msg) return normalizeToastText(value.msg, fallback);
    if (value.message) return normalizeToastText(value.message, fallback);
    if (value.detail) return normalizeToastText(value.detail, fallback);
    return fallback;
  }

  return fallback;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title = '', message = '', duration = 3200 }) => {
      const id = ++toastCounter;
      const safeTitle = normalizeToastText(title);
      const safeMessage = normalizeToastText(message, 'Не удалось выполнить операцию');

      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          title: safeTitle,
          message: safeMessage,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const api = useMemo(
    () => ({
      showToast,
      success: (message, title = 'Успешно') =>
        showToast({ type: 'success', title, message }),
      error: (message, title = 'Ошибка') =>
        showToast({ type: 'error', title, message }),
      info: (message, title = 'Информация') =>
        showToast({ type: 'info', title, message }),
      warning: (message, title = 'Внимание') =>
        showToast({ type: 'warning', title, message }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role="status"
            aria-live="polite"
          >
            <div className="toast__icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'warning' && '!'}
              {toast.type === 'info' && 'i'}
            </div>

            <div className="toast__content">
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>

            <button
              type="button"
              className="toast__close"
              onClick={() => removeToast(toast.id)}
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
};
