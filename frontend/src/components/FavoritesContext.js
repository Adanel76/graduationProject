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

  useEffect(() => {
    // Загружаем избранные туры из localStorage
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Ошибка загрузки избранных туров:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Сохраняем избранные туры в localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addToFavorites = (tour) => {
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

  const value = {
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    favoritesCount: favorites.length
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
