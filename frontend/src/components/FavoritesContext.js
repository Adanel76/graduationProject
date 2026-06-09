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

const FavoritesContext = createContext(null);

const areFavoriteListsEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const other = right[index];
    return (
      Number(item?.id) === Number(other?.id) &&
      String(item?.image_url || '') === String(other?.image_url || '') &&
      String(item?.image_data || '') === String(other?.image_data || '') &&
      String(item?.title || '') === String(other?.title || '')
    );
  });
};

export const FavoritesProvider = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  const [favorites, setFavoritesState] = useState([]);
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const initializedRef = useRef(false);
  const favoritesRef = useRef([]);

  const applyFavorites = useCallback((nextFavorites) => {
    favoritesRef.current = nextFavorites;

    if (!mountedRef.current) return;

    setFavoritesState((prev) => (areFavoriteListsEqual(prev, nextFavorites) ? prev : nextFavorites));
  }, []);

  const setFavorites = useCallback((updater) => {
    const nextFavorites = typeof updater === 'function' ? updater(favoritesRef.current) : updater || [];
    applyFavorites(nextFavorites);
  }, [applyFavorites]);

  const resetFavorites = useCallback(() => {
    initializedRef.current = false;
    inFlightRef.current = false;
    applyFavorites([]);
    if (mountedRef.current) {
      setLoading(false);
    }
  }, [applyFavorites]);

  const normalizeFavoriteTour = useCallback((item) => {
    if (!item) {
      return null;
    }

    return {
      ...item,
      id: Number(item.id),
      price: Number(item.price || 0),
      duration: Number(item.duration || 0),
      max_people: Number(item.max_people || 0),
      available_seats:
        item.available_seats === null || item.available_seats === undefined
          ? undefined
          : Number(item.available_seats),
      rating: Number(item.rating || 0),
      review_count: Number(item.review_count || 0),
    };
  }, []);

  const normalizeFavorites = useCallback((payload) => {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.map(normalizeFavoriteTour).filter(Boolean);
  }, [normalizeFavoriteTour]);

  const loadFavorites = useCallback(async (force = false) => {
    if (!isAuthenticated || !currentUserId) {
      resetFavorites();
      return [];
    }

    if (!force && initializedRef.current) {
      return favoritesRef.current;
    }

    if (inFlightRef.current) {
      return favoritesRef.current;
    }

    inFlightRef.current = true;

    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      const response = await tourismAPI.getFavorites();
      const normalized = normalizeFavorites(response?.data || []);
      initializedRef.current = true;
      applyFavorites(normalized);
      return normalized;
    } catch (error) {
      console.error('Ошибка загрузки избранного:', error);
      initializedRef.current = false;
      applyFavorites([]);
      return [];
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyFavorites, currentUserId, isAuthenticated, normalizeFavorites, resetFavorites]);

  const addToFavorites = useCallback(async (tourId, tourSnapshot = null) => {
    if (!isAuthenticated || !currentUserId) {
      throw new Error('Пользователь не авторизован');
    }

    const numericTourId = Number(tourId);
    const alreadyExists = favoritesRef.current.some((item) => Number(item.id) === numericTourId);

    if (alreadyExists) {
      return { success: true, alreadyExists: true };
    }

    const previousFavorites = favoritesRef.current;
    const optimisticTour = normalizeFavoriteTour(tourSnapshot);

    if (optimisticTour) {
      applyFavorites([optimisticTour, ...previousFavorites]);
    }

    try {
      await tourismAPI.addToFavorites(numericTourId);
      await loadFavorites(true);
      return { success: true };
    } catch (error) {
      if (error?.response?.status === 400) {
        await loadFavorites(true);
        return { success: true, alreadyExists: true };
      }

      applyFavorites(previousFavorites);
      throw error;
    }
  }, [applyFavorites, currentUserId, isAuthenticated, loadFavorites, normalizeFavoriteTour]);

  const removeFromFavorites = useCallback(async (tourId) => {
    if (!isAuthenticated || !currentUserId) {
      throw new Error('Пользователь не авторизован');
    }

    const numericTourId = Number(tourId);
    const previousFavorites = favoritesRef.current;

    applyFavorites(previousFavorites.filter((item) => Number(item.id) !== numericTourId));

    try {
      await tourismAPI.removeFromFavorites(numericTourId);
      return { success: true };
    } catch (error) {
      console.error('Ошибка удаления из избранного:', error);
      applyFavorites(previousFavorites);
      throw error;
    }
  }, [applyFavorites, currentUserId, isAuthenticated]);

  const isFavorite = useCallback((tourId) => {
    const numericTourId = Number(tourId);
    return favoritesRef.current.some((item) => Number(item.id) === numericTourId);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncFavorites = async () => {
      if (!isAuthenticated || !currentUserId) {
        resetFavorites();
        return;
      }
      if (!cancelled) {
        await loadFavorites(true);
      }
    };

    syncFavorites();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isAuthenticated, loadFavorites, resetFavorites]);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => Number(item.id))), [favorites]);

  const value = useMemo(() => ({
    favorites,
    favoriteIds,
    loading,
    loadFavorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    setFavorites,
    resetFavorites,
  }), [addToFavorites, favoriteIds, favorites, isFavorite, loadFavorites, loading, removeFromFavorites, resetFavorites, setFavorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }

  return context;
};
