import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  const host = window.location.hostname || 'localhost';
  return `http://${host}:8000`;
};

const cleanParams = (params = {}) => {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
};

export const BASE_URL = resolveApiBaseUrl();

export const resolveMediaUrl = (value) => {
  if (!value) return '';
  if (String(value).startsWith('/media/')) {
    return `${BASE_URL}${value}`;
  }
  return value;
};

export const FALLBACK_TOUR_IMAGE =
  'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=80';

const APP_IMAGE_CACHE_KEY = String(Date.now());

export const buildTourImageUrl = (tourId, cacheKey = APP_IMAGE_CACHE_KEY) => {
  const version = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : '';
  return `${BASE_URL}/tours/${tourId}/image${version}`;
};

export const getTourCardImageSrc = (tour) => {
  if (!tour) return FALLBACK_TOUR_IMAGE;

  if (tour.image_url) return resolveMediaUrl(tour.image_url);

  if (tour.image_data) {
    if (String(tour.image_data).startsWith('data:')) {
      return tour.image_data;
    }
    return `data:${tour.image_type || 'image/jpeg'};base64,${tour.image_data}`;
  }

  if (tour.id) return buildTourImageUrl(tour.id);
  return FALLBACK_TOUR_IMAGE;
};

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_ROUTES = [
  '/users/register',
  '/users/login',
  '/users/verify-email',
  '/users/resend-code',
  '/users/register/resend-code',
  '/users/forgot-password',
  '/users/reset-password',
  '/users/reset-password/request',
  '/users/reset-password/confirm',
];

const isPublicRoute = (url = '') => PUBLIC_ROUTES.some((route) => url.includes(route));

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !isPublicRoute(config.url || '')) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url || '';
    if (error?.response?.status === 401 && !isPublicRoute(requestUrl)) {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('currentUserCache');
    }
    return Promise.reject(error);
  }
);

const downloadBlobResponse = (response, fallbackName) => {
  const disposition = response?.headers?.['content-disposition'] || '';
  const matchedName = disposition.match(/filename=([^;]+)/i)?.[1]?.replace(/['"]/g, '');
  const filename = matchedName || fallbackName;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export const tourismAPI = {
  registerUser: (data) => api.post('/users/register', data),
  loginUser: (data) => api.post('/users/login', data),
  getCurrentUser: () => api.get('/users/me'),
  sendHeartbeat: () => api.post('/users/heartbeat'),
  getOnlineUsersCount: (seconds = 90) => api.get('/users/online-count', { params: { seconds } }),
  updateCurrentUser: (data) => api.put('/users/me', data),
  updateCurrentUserAvatar: async (data) => {
    try {
      return await api.put('/users/me/avatar', data);
    } catch (error) {
      // Фолбэк оставлен для совместимости, но основной маршрут — отдельный endpoint аватарки.
      if ([404, 405].includes(error?.response?.status)) {
        return api.put('/users/me', data);
      }
      throw error;
    }
  },
  deleteCurrentUserAvatar: async () => {
    try {
      return await api.delete('/users/me/avatar');
    } catch (error) {
      if ([404, 405].includes(error?.response?.status)) {
        return api.put('/users/me', { avatar_data: null, avatar_type: null });
      }
      throw error;
    }
  },
  verifyEmail: (data) => api.post('/users/verify-email', data),
  resendCode: (data) => api.post('/users/resend-code', data),
  forgotPassword: (data) => api.post('/users/forgot-password', data),
  resetPassword: (data) => api.post('/users/reset-password', data),

  getAllUsers: (params = {}) => api.get('/users/', { params: cleanParams(params) }),
  getUserById: (userId) => api.get(`/users/${userId}`),
  createUser: (data) => api.post('/users/', data),
  updateUser: (userId, data) => api.put(`/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
  updateUserRole: (userId, data) => api.patch(`/users/${userId}/role`, data),

  getTours: (params = {}) =>
    api.get('/tours/', {
      params: cleanParams({
        limit: 24,
        include_image_data: false,
        ...params,
      }),
    }),
  getLightTours: (params = {}) =>
    api.get('/tours/light', {
      params: cleanParams({ limit: 24, ...params }),
    }),
  getTourById: (tourId) => api.get(`/tours/${tourId}`),
  getTourGallery: (tourId) => api.get(`/tours/${tourId}/gallery`),
  replaceTourGallery: (tourId, data) => api.put(`/tours/${tourId}/gallery`, data),
  createTour: (data) => api.post('/tours/', data),
  updateTour: (tourId, data) => api.put(`/tours/${tourId}`, data),
  deleteTour: (tourId) => api.delete(`/tours/${tourId}`),

  importToursCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/tours/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadTourCsvTemplate: async () => {
    const response = await api.get('/tours/csv-template', { responseType: 'blob' });
    downloadBlobResponse(response, 'tours_import_template.csv');
    return response;
  },
  downloadToursCsv: async (params = {}) => {
    const response = await api.get('/tours/export-csv', {
      params: cleanParams(params),
      responseType: 'blob',
    });
    downloadBlobResponse(response, 'tours_export.csv');
    return response;
  },
  downloadTourCsv: async (tourId) => {
    const response = await api.get('/tours/' + tourId + '/export-csv', { responseType: 'blob' });
    downloadBlobResponse(response, 'tour_' + tourId + '.csv');
    return response;
  },
  getTourImageUrl: (tourId, cacheKey) => buildTourImageUrl(tourId, cacheKey),

  getBookings: (params = {}) => api.get('/bookings/', { params: cleanParams(params) }),
  createBooking: (data) => api.post('/bookings/', data),
  updateBooking: (bookingId, data) => api.put(`/bookings/${bookingId}`, data),
  updateBookingStatus: (bookingId, data) => api.patch(`/bookings/${bookingId}/status`, data),
  deleteBooking: (bookingId) => api.delete(`/bookings/${bookingId}`),

  getTourPlans: (params = {}) => api.get('/tour-plans/', { params: cleanParams(params) }),
  getTourPlan: (planId) => api.get(`/tour-plans/${planId}`),
  createTourPlan: (data) => api.post('/tour-plans/', data),
  updateTourPlan: (planId, data) => api.put(`/tour-plans/${planId}`, data),
  updateTourPlanStatus: (planId, data) => api.patch(`/tour-plans/${planId}/status`, data),
  deleteTourPlan: (planId) => api.delete(`/tour-plans/${planId}`),

  getReviews: (params = {}) => api.get('/reviews/', { params: cleanParams(params) }),
  createReview: (data) => api.post('/reviews/', data),
  updateReview: (reviewId, data) => api.put(`/reviews/${reviewId}`, data),
  deleteReview: (reviewId) => api.delete(`/reviews/${reviewId}`),

  getFavorites: (params = {}) => api.get('/favorites/', { params: cleanParams(params) }),
  addToFavorites: (tourId) => api.post('/favorites/', { tour_id: tourId }),
  removeFromFavorites: (tourId) => api.delete(`/favorites/${tourId}`),
  checkFavorite: (tourId) => api.get(`/favorites/check/${tourId}`),

  getNotifications: (params = {}) => api.get('/notifications/', { params: cleanParams(params) }),
  getUnreadNotificationsCount: () => api.get('/notifications/unread-count'),
  markNotificationAsRead: (notificationId) => api.patch(`/notifications/${notificationId}/read`),
  markAllNotificationsAsRead: () => api.patch('/notifications/read-all'),
  deleteNotification: (notificationId) => api.delete(`/notifications/${notificationId}`),
  getNotificationSettings: () => api.get('/notifications/settings'),
  updateNotificationSettings: (data) => api.put('/notifications/settings', data),

  getAnalyticsDashboard: (params = {}) => api.get('/analytics/dashboard', { params: cleanParams(params) }),
  getAnalyticsOverview: () => api.get('/analytics/overview'),
  trainMlAssistant: (params = {}) => api.post('/analytics/ml-assistant/train', null, { params: cleanParams(params) }),

  getCsvDatasets: () => api.get('/data-control/csv'),
  uploadCsvDataset: (file, datasetType = 'dataset') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/data-control/csv', formData, {
      params: cleanParams({ dataset_type: datasetType }),
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  previewCsvDataset: (datasetId) => api.get(`/data-control/csv/${datasetId}/preview`),
  deleteCsvDataset: (datasetId) => api.delete(`/data-control/csv/${datasetId}`),
  downloadCsvDataset: async (datasetId, filename = 'dataset.csv') => {
    const response = await api.get(`/data-control/csv/${datasetId}/download`, { responseType: 'blob' });
    downloadBlobResponse(response, filename);
    return response;
  },
  getUserStats: () => api.get('/users/stats'),

  getEvents: (params = {}) => api.get('/events/', { params: cleanParams({ limit: 12, ...params }) }),
  getAdminEvents: (params = {}) => api.get('/events/admin/all', { params: cleanParams({ limit: 200, ...params }) }),
  getEvent: (eventId) => api.get(`/events/${eventId}`),
  getEventById: (eventId) => api.get(`/events/${eventId}`),
  createEvent: (data) => api.post('/events/', data),
  updateEvent: (eventId, data) => api.put(`/events/${eventId}`, data),
  deleteEvent: (eventId) => api.delete(`/events/${eventId}`),

  exportReport: async (dataset, fileFormat = 'csv', params = {}) => {
    const extension = fileFormat === 'excel' ? 'xlsx' : fileFormat;
    const response = await api.get(`/reports/${dataset}/${fileFormat}`, {
      params: cleanParams(params),
      responseType: 'blob',
    });
    downloadBlobResponse(response, `${dataset}_report.${extension}`);
    return response;
  },

  downloadFile: async (url, filename = 'report') => {
    const response = await api.get(url, { responseType: 'blob' });
    downloadBlobResponse(response, filename);
    return response;
  },
};

export default api;
