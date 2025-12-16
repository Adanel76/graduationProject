import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем interceptor для автоматической установки токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const tourismAPI = {
  // Auth
  register: (userData) => api.post('/users/register', userData),
  login: (credentials) => api.post('/users/login', credentials),
  getCurrentUser: () => api.get('/users/me'),
  
  // Tours
  getTours: () => api.get('/tours/'),
  getTour: (id) => api.get(`/tours/${id}`),
  createTour: (tourData) => api.post('/tours/', tourData),
  updateTour: (id, tourData) => api.put(`/tours/${id}`, tourData),
  deleteTour: (id) => api.delete(`/tours/${id}`),
  
  // Bookings
  getBookings: () => api.get('/bookings/'),
  createBooking: (bookingData) => api.post('/bookings/', bookingData),
  updateBooking: (id, bookingData) => api.put(`/bookings/${id}`, bookingData),
  deleteBooking: (id) => api.delete(`/bookings/${id}`),
  
  // Reviews
  getReviews: () => api.get('/reviews/'),
  createReview: (reviewData) => api.post('/reviews/', reviewData),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
  
  // Password reset
  requestPasswordReset: (emailData) => api.post('/users/forgot-password', emailData),
  resetPassword: (resetData) => api.post('/users/reset-password', resetData),
};

export default api;
