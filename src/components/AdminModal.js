import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const AdminModal = ({ open, title, onClose, children, size = 'xl' }) => {
  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`admin-modal-overlay admin-modal-overlay--${size}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`admin-modal admin-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">{title}</h2>

          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            ×
          </button>
        </div>

        <div className="admin-modal__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminModal;