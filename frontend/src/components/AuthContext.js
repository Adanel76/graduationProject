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

const AuthContext = createContext(null);
const AUTH_USER_STORAGE_KEY = 'currentUserCache';

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.error('Ошибка чтения кэша пользователя:', error);
    return null;
  }
};

const writeCachedUser = (user) => {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Ошибка записи кэша пользователя:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const cachedUser = readCachedUser();

  const [currentUser, setCurrentUserState] = useState(cachedUser);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')) && !cachedUser);

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const currentUserRef = useRef(cachedUser);

  const setCurrentUser = useCallback((user) => {
    const nextUser = user || null;
    currentUserRef.current = nextUser;
    setCurrentUserState(nextUser);
    writeCachedUser(nextUser);

    if (nextUser?.role) {
      localStorage.setItem('userRole', nextUser.role);
    } else {
      localStorage.removeItem('userRole');
    }
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('pendingVerificationEmail');
    setCurrentUser(null);
    if (mountedRef.current) {
      setLoading(false);
    }
  }, [setCurrentUser]);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const refreshUser = useCallback(async (options = {}) => {
    const { force = false, silent = false } = options;
    const token = localStorage.getItem('token');

    if (!token) {
      if (mountedRef.current) {
        setCurrentUser(null);
        setLoading(false);
      }
      return null;
    }

    if (!force && inFlightRef.current) {
      return currentUserRef.current;
    }

    inFlightRef.current = true;

    if (mountedRef.current && !silent && !currentUserRef.current) {
      setLoading(true);
    }

    try {
      const response = await tourismAPI.getCurrentUser();
      const user = response?.data || null;
      if (mountedRef.current) {
        setCurrentUser(user);
      }
      return user;
    } catch (error) {
      console.error('Ошибка загрузки текущего пользователя:', error);
      if (error?.response?.status === 401) {
        clearAuth();
      }
      return null;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [clearAuth, setCurrentUser]);

  const login = useCallback(async (emailOrPayload, passwordArg) => {
    let email = '';
    let password = '';

    if (typeof emailOrPayload === 'object' && emailOrPayload !== null) {
      email = String(emailOrPayload.email || '').trim().toLowerCase();
      password = String(emailOrPayload.password || '');
    } else {
      email = String(emailOrPayload || '').trim().toLowerCase();
      password = String(passwordArg || '');
    }

    const loginResponse = await tourismAPI.loginUser({ email, password });
    const accessToken = loginResponse?.data?.access_token;

    if (!accessToken) {
      throw new Error('Токен не получен');
    }

    localStorage.setItem('token', accessToken);
    const user = await refreshUser({ force: true, silent: true });
    if (!user) {
      throw new Error('Не удалось получить пользователя');
    }
    return user;
  }, [refreshUser]);

  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem('token');

    if (token) {
      refreshUser({ force: true, silent: Boolean(currentUserRef.current) });
    } else {
      setLoading(false);
    }

    const handleStorage = (event) => {
      if (event.key === 'token') {
        if (!event.newValue) {
          clearAuth();
        } else {
          refreshUser({ force: true, silent: false });
        }
      }

      if (event.key === AUTH_USER_STORAGE_KEY) {
        if (!event.newValue) {
          setCurrentUser(null);
          return;
        }

        try {
          const nextUser = JSON.parse(event.newValue);
          currentUserRef.current = nextUser;
          setCurrentUserState(nextUser);
        } catch (error) {
          console.error('Ошибка синхронизации кэша пользователя:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, [clearAuth, refreshUser, setCurrentUser]);

  useEffect(() => {
    if (!currentUser?.id || !localStorage.getItem('token')) {
      return undefined;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      try {
        await tourismAPI.sendHeartbeat();
      } catch (error) {
        if (!cancelled && error?.response?.status === 401) {
          clearAuth();
        }
      }
    };

    const sendVisibleHeartbeat = () => {
      if (document.visibilityState !== 'hidden') {
        sendHeartbeat();
      }
    };

    sendVisibleHeartbeat();
    const intervalId = window.setInterval(sendVisibleHeartbeat, 25000);

    window.addEventListener('focus', sendVisibleHeartbeat);
    window.addEventListener('online', sendVisibleHeartbeat);
    document.addEventListener('visibilitychange', sendVisibleHeartbeat);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', sendVisibleHeartbeat);
      window.removeEventListener('online', sendVisibleHeartbeat);
      document.removeEventListener('visibilitychange', sendVisibleHeartbeat);
    };
  }, [clearAuth, currentUser?.id]);

  const value = useMemo(() => ({
    currentUser,
    user: currentUser,
    loading,
    isAuthenticated: Boolean(currentUser),
    login,
    logout,
    refreshUser,
    setCurrentUser,
  }), [currentUser, loading, login, logout, refreshUser, setCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
