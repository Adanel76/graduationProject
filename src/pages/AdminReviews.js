import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useToast } from '../components/ToastContext';
import { useConfirmDialog } from '../components/ConfirmDialogContext';

const renderStars = (rating) => {
  const value = Number(rating || 0);

  return (
    <div className="admin-reviews-stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={
            index < value
              ? 'admin-reviews-stars__star admin-reviews-stars__star--active'
              : 'admin-reviews-stars__star'
          }
        >
          ★
        </span>
      ))}
    </div>
  );
};

const AdminReviews = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirmDialog();

  const [reviews, setReviews] = useState([]);
  const [tours, setTours] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [tourFilter, setTourFilter] = useState('');

  const [selectedReview, setSelectedReview] = useState(null);
  const [drawerError, setDrawerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    rating: 5,
    comment: '',
  });

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const [meResponse, reviewsResponse, toursResponse, usersResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getReviews(),
        tourismAPI.getTours(),
        tourismAPI.getAllUsers(),
      ]);

      const me = meResponse.data;

      if (!['admin', 'manager'].includes(me.role)) {
        navigate('/profile');
        return;
      }

      setReviews(reviewsResponse.data || []);
      setTours(toursResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      console.error('Ошибка загрузки отзывов:', error);

      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (error.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setPageError('Не удалось загрузить отзывы');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const closeDrawer = useCallback(() => {
    setSelectedReview(null);
    setDrawerError('');
    setEditForm({
      rating: 5,
      comment: '',
    });
  }, []);

  useEffect(() => {
    if (!selectedReview) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedReview, closeDrawer]);

  const enrichedReviews = useMemo(() => {
    return [...reviews]
      .map((review) => {
        const tour = tours.find((item) => item.id === review.tour_id);
        const user = users.find((item) => item.id === review.user_id);

        return {
          ...review,
          tour,
          user,
        };
      })
      .sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return bDate - aDate;
      });
  }, [reviews, tours, users]);

  const filteredReviews = useMemo(() => {
    return enrichedReviews.filter((review) => {
      const text = [
        review.id,
        review.comment,
        review.user?.first_name,
        review.user?.last_name,
        review.user?.email,
        review.tour?.title,
        review.tour?.country,
        review.tour?.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesRating = ratingFilter ? String(review.rating) === String(ratingFilter) : true;
      const matchesTour = tourFilter ? String(review.tour_id) === String(tourFilter) : true;

      return matchesSearch && matchesRating && matchesTour;
    });
  }, [enrichedReviews, search, ratingFilter, tourFilter]);

  const stats = useMemo(() => {
    const total = enrichedReviews.length;
    const average =
      total > 0
        ? (
            enrichedReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total
          ).toFixed(1)
        : '0.0';

    const fiveStars = enrichedReviews.filter((item) => Number(item.rating) === 5).length;
    const lowRated = enrichedReviews.filter((item) => Number(item.rating) <= 2).length;

    return { total, average, fiveStars, lowRated };
  }, [enrichedReviews]);

  const getUserName = (review) => {
    if (!review.user) return `Пользователь #${review.user_id}`;
    const fullName = `${review.user.first_name || ''} ${review.user.last_name || ''}`.trim();
    return fullName || review.user.email || `Пользователь #${review.user_id}`;
  };

  const getTourName = (review) => {
    if (!review.tour) return `Тур #${review.tour_id}`;
    return review.tour.title;
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('ru-RU');
  };

  const openDrawer = (review) => {
    setDrawerError('');
    setSelectedReview(review);
    setEditForm({
      rating: Number(review.rating || 5),
      comment: review.comment || '',
    });
  };

  const handleSave = async () => {
    if (!selectedReview) return;

    try {
      setSaving(true);
      setDrawerError('');

      const response = await tourismAPI.updateReview(selectedReview.id, {
        tour_id: selectedReview.tour_id,
        rating: Number(editForm.rating),
        comment: editForm.comment,
      });

      const updatedReview = response.data;

      setReviews((prev) =>
        prev.map((item) => (item.id === updatedReview.id ? updatedReview : item))
      );

      const updatedEnriched = {
        ...updatedReview,
        tour: tours.find((item) => item.id === updatedReview.tour_id),
        user: users.find((item) => item.id === updatedReview.user_id),
      };

      setSelectedReview(updatedEnriched);
      toast.success('Отзыв обновлён');
    } catch (error) {
      console.error('Ошибка обновления отзыва:', error);
      setDrawerError(error.response?.data?.detail || 'Не удалось обновить отзыв');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reviewId) => {
    const confirmed = await confirm({
      title: 'Удалить отзыв?',
      message: 'Отзыв будет удалён без возможности быстрого восстановления.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      await tourismAPI.deleteReview(reviewId);
      setReviews((prev) => prev.filter((item) => item.id !== reviewId));
      toast.success('Отзыв удалён');

      if (selectedReview?.id === reviewId) {
        closeDrawer();
      }
    } catch (error) {
      console.error('Ошибка удаления отзыва:', error);
      setDrawerError(error.response?.data?.detail || 'Не удалось удалить отзыв');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRatingFilter('');
    setTourFilter('');
  };

  if (loading) {
    return (
      <div className="admin-reviews-page">
        <div className="page-shell">
          <div className="home-empty">Загрузка отзывов...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-reviews-page">
      <div className="page-shell">
        <section className="admin-reviews-hero motion-rise">
          <div>
            <span className="home-hero__eyebrow">Reviews / Moderation</span>
            <h1 className="admin-reviews-hero__title">Управление отзывами</h1>
            <p className="admin-reviews-hero__text">
              Просматривайте отзывы клиентов, редактируйте некорректные данные,
              анализируйте оценки и быстро удаляйте нерелевантные записи.
            </p>
          </div>

          <div className="admin-reviews-hero__stats">
            <div className="compact-stat">
              <span>Всего</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="compact-stat">
              <span>Средний рейтинг</span>
              <strong>{stats.average}</strong>
            </div>
            <div className="compact-stat">
              <span>5 звёзд</span>
              <strong>{stats.fiveStars}</strong>
            </div>
            <div className="compact-stat">
              <span>Низкие оценки</span>
              <strong>{stats.lowRated}</strong>
            </div>
          </div>
        </section>

        <section className="admin-reviews-toolbar motion-fade">
          <div className="admin-reviews-toolbar__left">
            <input
              type="text"
              className="admin-table-search"
              placeholder="Поиск по клиенту, туру, тексту отзыва..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="admin-reviews-select"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="">Все оценки</option>
              <option value="5">5 звёзд</option>
              <option value="4">4 звезды</option>
              <option value="3">3 звезды</option>
              <option value="2">2 звезды</option>
              <option value="1">1 звезда</option>
            </select>

            <select
              className="admin-reviews-select"
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
            >
              <option value="">Все туры</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.title}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-reviews-toolbar__right">
            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={clearFilters}
            >
              Сбросить
            </button>

            <button
              type="button"
              className="site-button site-button--primary"
              onClick={loadPage}
            >
              Обновить
            </button>
          </div>
        </section>

        {pageError && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
            {pageError}
          </div>
        )}

        <section className="admin-table-shell motion-fade">
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Клиент</th>
                  <th>Тур</th>
                  <th>Оценка</th>
                  <th>Комментарий</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="admin-reviews-empty-row">
                        Отзывы по заданным фильтрам не найдены
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        <strong>#{review.id}</strong>
                      </td>

                      <td>
                        <div className="admin-reviews-person">
                          <strong>{getUserName(review)}</strong>
                          <span>{review.user?.email || '—'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="admin-reviews-tour">
                          <strong>{getTourName(review)}</strong>
                          <span>
                            {review.tour ? `${review.tour.city}, ${review.tour.country}` : '—'}
                          </span>
                        </div>
                      </td>

                      <td>{renderStars(review.rating)}</td>

                      <td>
                        <div className="admin-reviews-comment">
                          {review.comment || 'Комментарий отсутствует'}
                        </div>
                      </td>

                      <td>{formatDateTime(review.created_at)}</td>

                      <td>
                        <div className="admin-reviews-actions">
                          <button
                            type="button"
                            className="site-button site-button--secondary"
                            onClick={() => openDrawer(review)}
                          >
                            Открыть
                          </button>

                          <button
                            type="button"
                            className="site-button site-button--danger"
                            onClick={() => handleDelete(review.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedReview && (
        <>
          <div className="admin-drawer-backdrop" onClick={closeDrawer} />

          <aside className="admin-drawer">
            <div className="admin-reviews-drawer__head">
              <div>
                <span className="home-hero__eyebrow">Review detail</span>
                <h2 className="admin-reviews-drawer__title">
                  Отзыв #{selectedReview.id}
                </h2>
                <p className="admin-reviews-drawer__subtitle">
                  {getUserName(selectedReview)} — {getTourName(selectedReview)}
                </p>
              </div>

              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={closeDrawer}
              >
                Закрыть
              </button>
            </div>

            <div className="admin-reviews-drawer__summary">
              <div className="compact-card">
                <span className="admin-reviews-drawer__label">Клиент</span>
                <strong>{getUserName(selectedReview)}</strong>
                <p>{selectedReview.user?.email || 'Email не найден'}</p>
              </div>

              <div className="compact-card">
                <span className="admin-reviews-drawer__label">Тур</span>
                <strong>{getTourName(selectedReview)}</strong>
                <p>
                  {selectedReview.tour
                    ? `${selectedReview.tour.city}, ${selectedReview.tour.country}`
                    : 'Тур недоступен'}
                </p>
              </div>

              <div className="compact-card">
                <span className="admin-reviews-drawer__label">Дата создания</span>
                <strong>{formatDateTime(selectedReview.created_at)}</strong>
                <p>Оценка: {selectedReview.rating || '—'}</p>
              </div>

              <div className="compact-card">
                <span className="admin-reviews-drawer__label">Текущий рейтинг</span>
                <div style={{ marginTop: '8px' }}>{renderStars(selectedReview.rating)}</div>
              </div>
            </div>

            <div className="admin-reviews-drawer__form">
              <div className="ui-field">
                <label htmlFor="review-rating">Оценка</label>
                <select
                  id="review-rating"
                  value={editForm.rating}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, rating: Number(e.target.value) }))
                  }
                >
                  <option value={5}>5</option>
                  <option value={4}>4</option>
                  <option value={3}>3</option>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="review-comment">Комментарий</label>
                <textarea
                  id="review-comment"
                  rows="7"
                  value={editForm.comment}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, comment: e.target.value }))
                  }
                />
              </div>

              {drawerError && (
                <div className="detail-alert detail-alert--error">{drawerError}</div>
              )}

              <div className="admin-reviews-drawer__actions">
                <button
                  type="button"
                  className="site-button site-button--danger"
                  onClick={() => handleDelete(selectedReview.id)}
                  disabled={saving}
                >
                  Удалить отзыв
                </button>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="site-button site-button--secondary"
                    onClick={closeDrawer}
                    disabled={saving}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="site-button site-button--primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default AdminReviews;