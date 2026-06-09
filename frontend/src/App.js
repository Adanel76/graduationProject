import React from 'react';
import { Routes, Route } from 'react-router-dom';

import { AuthProvider } from './components/AuthContext';
import { NotificationsProvider } from './components/NotificationsContext';
import { FavoritesProvider } from './components/FavoritesContext';

import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import RoleRoute from './components/RoleRoute';

import Home from './pages/Home';
import Tours from './pages/Tours';
import TourDetailPage from './pages/TourDetailPage';
import TourConstructor from './pages/TourConstructor';
import Login from './pages/Login';
import Register from './pages/Register';
import UserAgreement from './pages/UserAgreement';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import Favorites from './pages/Favorites';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import Notifications from './pages/Notifications';
import NotificationSettings from './pages/NotificationSettings';

import AdminDashboard from './pages/AdminDashboard';
import AdminTours from './pages/AdminTours';
import AdminBookings from './pages/AdminBookings';
import AdminReviews from './pages/AdminReviews';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminUsers from './pages/AdminUsers';
import AdminReports from './pages/AdminReports';
import AdminEvents from './pages/AdminEvents';
import AdminDataControl from './pages/AdminDataControl';

import Events from './pages/Events';
import EventDetailPage from './pages/EventDetailPage';

import { ToastProvider } from './components/ToastContext';
import { ConfirmDialogProvider } from './components/ConfirmDialogContext';
import PageTransition from './components/PageTransition';
import Footer from './components/Footer';
import About from './pages/About';

import './App.css';


function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <FavoritesProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <div className="App">
                <Header />

                <main>
                  <Routes>
                    <Route path="/" element={<PageTransition><Home /></PageTransition>} />
                    <Route path="/tours" element={<PageTransition><Tours /></PageTransition>} />
                    <Route path="/tours/:id" element={<PageTransition><TourDetailPage /></PageTransition>} />
                    <Route path="/tour-constructor" element={<PageTransition><TourConstructor /></PageTransition>} />

                    <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
                    <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
                    <Route path="/user-agreement" element={<PageTransition><UserAgreement /></PageTransition>} />
                    <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />
                    <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/:id" element={<EventDetailPage />} />
                    <Route path="/about" element={<About />} />

                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <PageTransition>
                            <Profile />
                          </PageTransition>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/favorites"
                      element={
                        <ProtectedRoute>
                          <Favorites />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/notifications"
                      element={
                        <ProtectedRoute>
                          <Notifications />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/notifications/settings"
                      element={
                        <ProtectedRoute>
                          <NotificationSettings />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/checkout"
                      element={
                        <ProtectedRoute>
                          <Checkout />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/my-bookings"
                      element={
                        <ProtectedRoute>
                          <MyBookings />
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/admin"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager', 'analyst']}>
                          <AdminDashboard />
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/tours"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager']}>
                          <PageTransition>
                            <AdminTours />
                          </PageTransition>
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/bookings"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager']}>
                          <AdminBookings />
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/reviews"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager']}>
                          <AdminReviews />
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/analytics"
                      element={
                        <RoleRoute allowedRoles={['admin', 'analyst']}>
                          <AdminAnalytics />
                        </RoleRoute>
                      }
                    />



                    <Route
                      path="/admin/data"
                      element={
                        <RoleRoute allowedRoles={['admin', 'analyst']}>
                          <PageTransition>
                            <AdminDataControl />
                          </PageTransition>
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/events"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager']}>
                          <AdminEvents />
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/reports"
                      element={
                        <RoleRoute allowedRoles={['admin', 'manager']}>
                          <AdminReports />
                        </RoleRoute>
                      }
                    />

                    <Route
                      path="/admin/users"
                      element={
                        <AdminRoute>
                          <AdminUsers />
                        </AdminRoute>
                      }
                    />
                  </Routes>

                  <Footer />
                </main>
              </div>
            </ConfirmDialogProvider>
          </ToastProvider>
        </FavoritesProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;
