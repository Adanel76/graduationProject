import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ConfirmDialogContext = createContext(null);

export const ConfirmDialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Подтвердить',
    cancelText: 'Отмена',
    tone: 'danger',
    onConfirm: null,
  });

  const closeDialog = useCallback(() => {
    setDialog({
      open: false,
      title: '',
      message: '',
      confirmText: 'Подтвердить',
      cancelText: 'Отмена',
      tone: 'danger',
      onConfirm: null,
    });
    document.body.style.overflow = '';
  }, []);

  const confirm = useCallback(
    ({ title, message, confirmText = 'Подтвердить', cancelText = 'Отмена', tone = 'danger' }) =>
      new Promise((resolve) => {
        document.body.style.overflow = 'hidden';

        setDialog({
          open: true,
          title,
          message,
          confirmText,
          cancelText,
          tone,
          onConfirm: () => {
            closeDialog();
            resolve(true);
          },
        });

        const handleCancel = () => {
          closeDialog();
          resolve(false);
        };

        setDialog((prev) => ({
          ...prev,
          onCancel: handleCancel,
        }));
      }),
    [closeDialog]
  );

  const value = useMemo(() => ({ confirm, closeDialog }), [confirm, closeDialog]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      {dialog.open && (
        <>
          <div
            className="confirm-dialog-backdrop"
            onClick={dialog.onCancel}
          />

          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <div className="confirm-dialog__icon">
              {dialog.tone === 'danger' ? '!' : '?'}
            </div>

            <div className="confirm-dialog__content">
              <h3 id="confirm-dialog-title">{dialog.title}</h3>
              <p>{dialog.message}</p>
            </div>

            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={dialog.onCancel}
              >
                {dialog.cancelText}
              </button>

              <button
                type="button"
                className={`site-button ${
                  dialog.tone === 'danger'
                    ? 'site-button--danger'
                    : 'site-button--primary'
                }`}
                onClick={dialog.onConfirm}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </>
      )}
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }

  return context;
};