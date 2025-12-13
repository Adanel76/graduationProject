import React, { useState, useEffect } from 'react';
import TourCard from '../components/TourCard';
import { tourismAPI } from '../services/api';

const Tours = () => {
  const [tours, setTours] = useState([]);
  const [filteredTours, setFilteredTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояния для фильтров
  const [filters, setFilters] = useState({
    search: '',
    minPrice: '',
    maxPrice: '',
    country: '',
    startDate: '',
    endDate: '',
    duration: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  
  // Уникальные страны для фильтра
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    loadTours();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tours, filters]);

  const loadTours = async () => {
    try {
      setLoading(true);
      const response = await tourismAPI.getTours();
      setTours(response.data);
      
      // Получаем уникальные страны
      const uniqueCountries = [...new Set(response.data.map(tour => tour.country))];
      setCountries(uniqueCountries);
      
    } catch (error) {
      console.error('Ошибка загрузки туров:', error);
      setError('Ошибка загрузки туров');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tours];
    
    // Поиск по названию
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(tour => 
        tour.title.toLowerCase().includes(searchTerm) ||
        tour.description.toLowerCase().includes(searchTerm) ||
        tour.city.toLowerCase().includes(searchTerm) ||
        tour.country.toLowerCase().includes(searchTerm)
      );
    }
    
    // Фильтр по цене
    if (filters.minPrice) {
      filtered = filtered.filter(tour => tour.price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      filtered = filtered.filter(tour => tour.price <= parseFloat(filters.maxPrice));
    }
    
    // Фильтр по стране
    if (filters.country) {
      filtered = filtered.filter(tour => tour.country === filters.country);
    }
    
    // Фильтр по датам
    if (filters.startDate) {
      filtered = filtered.filter(tour => new Date(tour.start_date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter(tour => new Date(tour.end_date) <= new Date(filters.endDate));
    }
    
    // Фильтр по длительности
    if (filters.duration) {
      filtered = filtered.filter(tour => tour.duration.toString() === filters.duration);
    }
    
    // Сортировка
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (filters.sortBy) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'duration':
          aValue = a.duration;
          bValue = b.duration;
          break;
        case 'start_date':
          aValue = new Date(a.start_date);
          bValue = new Date(b.start_date);
          break;
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }
      
      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredTours(filtered);
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      minPrice: '',
      maxPrice: '',
      country: '',
      startDate: '',
      endDate: '',
      duration: '',
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка туров...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Все туры</h1>
      
      {/* Панель фильтров */}
      <div style={styles.filterPanel}>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Поиск:</label>
            <input
              type="text"
              placeholder="Название, описание, город..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Цена от:</label>
            <input
              type="number"
              placeholder="Мин. цена"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Цена до:</label>
            <input
              type="number"
              placeholder="Макс. цена"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              style={styles.filterInput}
            />
          </div>
        </div>
        
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Страна:</label>
            <select
              value={filters.country}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">Все страны</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Дата начала от:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Дата окончания до:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Длительность (дней):</label>
            <select
              value={filters.duration}
              onChange={(e) => handleFilterChange('duration', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">Любая</option>
              <option value="3">3 дня</option>
              <option value="5">5 дней</option>
              <option value="7">7 дней</option>
              <option value="10">10 дней</option>
              <option value="14">14 дней</option>
            </select>
          </div>
        </div>
        
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Сортировать по:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="created_at">Дате добавления</option>
              <option value="price">Цене</option>
              <option value="duration">Длительности</option>
              <option value="start_date">Дате начала</option>
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Порядок:</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              style={styles.filterSelect}
            >
              <option value="desc">По убыванию</option>
              <option value="asc">По возрастанию</option>
            </select>
          </div>
          
          <div style={styles.filterGroup}>
            <button 
              onClick={clearFilters}
              style={{
                ...styles.filterButton,
                backgroundColor: '#e74c3c'
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>
      
      {/* Информация о результатах */}
      <div style={styles.resultsInfo}>
        Найдено туров: {filteredTours.length}
        {filteredTours.length !== tours.length && (
          <span> (из {tours.length} общих)</span>
        )}
      </div>
      
      {/* Список туров */}
      {filteredTours.length === 0 ? (
        <div style={styles.noResults}>
          <h3>Туры не найдены</h3>
          <p>Попробуйте изменить параметры поиска или фильтры</p>
          <button 
            onClick={clearFilters}
            style={styles.filterButton}
          >
            Сбросить все фильтры
          </button>
        </div>
      ) : (
        <div style={styles.toursGrid}>
          {filteredTours.map(tour => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  title: {
    textAlign: 'center',
    margin: '2rem 0',
    color: '#2c3e50',
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', // Изменили с auto-fit на auto-fill
    gap: '2rem',
    marginTop: '2rem',
  },
  filterPanel: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '1.5rem',
    marginBottom: '2rem',
    boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '1rem',
  },
  filterGroup: {
    flex: '1',
    minWidth: '200px',
  },
  filterLabel: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    fontSize: '0.9rem',
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', // Изменили с auto-fit на auto-fill
    gap: '2rem',
    marginTop: '2rem',
  },
  filterInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '0.9rem',
  },
  filterSelect: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '0.9rem',
    backgroundColor: 'white',
  },
  filterButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  resultsInfo: {
    textAlign: 'center',
    marginBottom: '1rem',
    color: '#7f8c8d',
    fontSize: '1.1rem',
  },
  noResults: {
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
  },
  error: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#e74c3c',
  },
};

export default Tours;
