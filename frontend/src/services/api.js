import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

// Создаем экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API функции
export const tourismAPI = {
  // Туры
  getTours: () => api.get('/tours/'),
  getTour: (id) => api.get(`/tours/${id}`),
  createTour: (tourData) => api.post('/tours/', tourData),
  updateTour: (id, tourData) => api.put(`/tours/${id}`, tourData),
  deleteTour: (id) => api.delete(`/tours/${id}`),

  // Пользователи - новая логика регистрации
  startRegistration: (userData) => api.post('/users/register/start', userData),
  resendVerificationCode: (email) => api.post('/users/register/resend-code', null, { params: { email } }),
  completeRegistration: (verificationData) => api.post('/users/register/complete', verificationData),
  login: (credentials) => api.post('/users/login', credentials),
  getCurrentUser: () => api.get('/users/me'),
  verifyEmail: (verificationData) => api.post('/users/verify-email', verificationData),
  
  // Сброс пароля
  requestPasswordReset: (emailData) => api.post('/users/reset-password/request', emailData),
  resetPassword: (resetData) => api.post('/users/reset-password/confirm', resetData),

  // Бронирования
  getBookings: () => api.get('/bookings/'),
  createBooking: (bookingData) => api.post('/bookings/', bookingData),
  updateBooking: (id, bookingData) => api.put(`/bookings/${id}`, bookingData),
  deleteBooking: (id) => api.delete(`/bookings/${id}`),

  // Отзывы
  getReviews: () => api.get('/reviews/'),
  createReview: (reviewData) => api.post('/reviews/', reviewData),
  updateReview: (id, reviewData) => api.put(`/reviews/${id}`, reviewData),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
};

export default tourismAPI;
