import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { tourismAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

const POLL_INTERVAL = 60000;
const MIN_REFRESH_GAP = 15000;

export const NotificationsProvider = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const intervalRef = useRef(null);
  const lastLoadedAtRef = useRef(0);
  const unreadCountRef = useRef(0);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetNotificationsState = useCallback(() => {
    setUnreadCount(0);
    setLoading(false);
    unreadCountRef.current = 0;
    lastLoadedAtRef.current = 0;
    inFlightRef.current = false;
    clearPolling();
  }, [clearPolling]);

  const refreshUnreadCount = useCallback(async (force = false) => {
    if (!isAuthenticated || !currentUserId) {
      if (mountedRef.current) {
        setUnreadCount(0);
        setLoading(false);
      }
      unreadCountRef.current = 0;
      return 0;
    }

    if (!force && typeof document !== 'undefined' && document.hidden) {
      return unreadCountRef.current;
    }

    const now = Date.now();
    if (!force && now - lastLoadedAtRef.current < MIN_REFRESH_GAP) {
      return unreadCountRef.current;
    }

    if (inFlightRef.current) {
      return unreadCountRef.current;
    }

    inFlightRef.current = true;

    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      const response = await tourismAPI.getUnreadNotificationsCount();
      const nextCount = Number(response?.data?.unread_count || 0);
      unreadCountRef.current = nextCount;

      if (mountedRef.current) {
        setUnreadCount(nextCount);
        lastLoadedAtRef.current = Date.now();
      }

      return nextCount;
    } catch (error) {
      console.error('Ошибка загрузки количества непрочитанных уведомлений:', error);

      if (error?.response?.status === 401) {
        unreadCountRef.current = 0;
        if (mountedRef.current) {
          setUnreadCount(0);
        }
      }

      return 0;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  useEffect(() => {
    clearPolling();

    if (!isAuthenticated || !currentUserId) {
      resetNotificationsState();
      return undefined;
    }

    refreshUnreadCount(true);

    intervalRef.current = setInterval(() => {
      refreshUnreadCount(false);
    }, POLL_INTERVAL);

    return () => {
      clearPolling();
    };
  }, [clearPolling, currentUserId, isAuthenticated, refreshUnreadCount, resetNotificationsState]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshUnreadCount(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUserId, isAuthenticated, refreshUnreadCount]);

  const value = useMemo(() => ({
    unreadCount,
    loading,
    setUnreadCount,
    refreshUnreadCount,
    resetNotificationsState,
  }), [loading, refreshUnreadCount, resetNotificationsState, unreadCount]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }

  return context;
};
