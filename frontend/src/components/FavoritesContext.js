import React, { createContext, useState, useContext, useEffect } from 'react';

const FavoritesContext = createContext();

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const MAX_FAVORITES = 50; // Ограничение на количество избранных туров

  // Оптимизированная функция сохранения в localStorage
  const saveFavoritesToStorage = (favoritesToSave) => {
    try {
      // Сохраняем только необходимые поля для экономии места
      const favoritesForStorage = favoritesToSave.map(tour => ({
        id: tour.id,
        title: tour.title,
        price: tour.price,
        country: tour.country,
        city: tour.city,
        duration: tour.duration,
        start_date: tour.start_date,
        image_data: tour.image_data,
        max_people: tour.max_people
      }));
      
      const favoritesString = JSON.stringify(favoritesForStorage);
      
      // Проверяем размер данных перед сохранением
      if (favoritesString.length > 4 * 1024 * 1024) { // 4MB лимит
        console.warn('Favorites data too large, clearing old favorites');
        // Очищаем часть старых данных
        const reducedFavorites = favoritesForStorage.slice(0, Math.floor(MAX_FAVORITES / 2));
        localStorage.setItem('favorites', JSON.stringify(reducedFavorites));
        return reducedFavorites;
      }
      
      localStorage.setItem('favorites', favoritesString);
      return favoritesForStorage;
    } catch (e) {
      console.error('Ошибка сохранения избранных туров:', e);
      // Если localStorage переполнен, очищаем его
      if (e.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, clearing favorites');
        localStorage.removeItem('favorites');
      }
      return [];
    }
  };

  // Загрузка избранных туров с обработкой ошибок
  const loadFavoritesFromStorage = () => {
    try {
      const savedFavorites = localStorage.getItem('favorites');
      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);
        // Проверяем, что данные корректны
        if (Array.isArray(parsedFavorites)) {
          return parsedFavorites;
        }
      }
    } catch (e) {
      console.error('Ошибка загрузки избранных туров:', e);
      // Очищаем поврежденные данные
      localStorage.removeItem('favorites');
    }
    return [];
  };

  useEffect(() => {
    const loadedFavorites = loadFavoritesFromStorage();
    setFavorites(loadedFavorites);
  }, []);

  useEffect(() => {
    if (favorites.length > 0) {
      saveFavoritesToStorage(favorites);
    }
  }, [favorites]);

  const addToFavorites = (tour) => {
    // Проверяем лимит
    if (favorites.length >= MAX_FAVORITES) {
      console.warn(`Достигнут лимит избранных туров (${MAX_FAVORITES})`);
      alert(`Максимальное количество избранных туров: ${MAX_FAVORITES}`);
      return;
    }
    
    // Проверяем, что тур еще не в избранном
    if (!favorites.find(fav => fav.id === tour.id)) {
      setFavorites(prev => [...prev, tour]);
    }
  };

  const removeFromFavorites = (tourId) => {
    setFavorites(prev => prev.filter(tour => tour.id !== tourId));
  };

  const isFavorite = (tourId) => {
    return favorites.some(tour => tour.id === tourId);
  };

  const clearAllFavorites = () => {
    setFavorites([]);
    localStorage.removeItem('favorites');
  };

  const value = {
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    favoritesCount: favorites.length,
    clearAllFavorites,
    maxFavorites: MAX_FAVORITES
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
