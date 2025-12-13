import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { FavoritesProvider } from './components/FavoritesContext';
import Header from './components/Header';
import Home from './pages/Home';
import Tours from './pages/Tours';
import TourDetailPage from './pages/TourDetailPage';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import NotificationSettings from './pages/NotificationSettings';
import Favorites from './pages/Favorites';
import Checkout from './pages/Checkout'; // Добавим
import AdminDashboard from './pages/AdminDashboard';
import AdminTours from './pages/AdminTours';
import AdminBookings from './pages/AdminBookings';
import AdminReviews from './pages/AdminReviews';
import AdminReports from './pages/AdminReports';
import './App.css';

function App() {
  return (
    <FavoritesProvider>
      <div className="App">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/tours/:id" element={<TourDetailPage />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/checkout" element={<Checkout />} /> {/* Добавим */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationSettings />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tours" element={<AdminTours />} />
            <Route path="/admin/bookings" element={<AdminBookings />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Routes>
        </main>
      </div>
    </FavoritesProvider>
  );
}

export default App;
