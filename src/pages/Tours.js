import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TourCard from '../components/TourCard';
import { tourismAPI } from '../services/api';
import { PageHeroSkeleton, ToursGridSkeleton } from '../components/Skeletons';

const DEFAULT_FILTERS = {
  search: '',
  minPrice: '',
  maxPrice: '',
  country: '',
  startDate: '',
  endDate: '',
  duration: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

const Tours = () => {
  const [tours, setTours] = useState([]);
  const [countries, setCountries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const buildApiParams = useCallback((sourceFilters) => {
    return {
      limit: 24,
      search: sourceFilters.search || undefined,
      min_price: sourceFilters.minPrice || undefined,
      max_price: sourceFilters.maxPrice || undefined,
      country: sourceFilters.country || undefined,
      start_date: sourceFilters.startDate || undefined,
      end_date: sourceFilters.endDate || undefined,
      duration: sourceFilters.duration || undefined,
      sort_by: sourceFilters.sortBy || 'created_at',
      sort_order: sourceFilters.sortOrder || 'desc',
    };
  }, []);

  const loadTours = useCallback(async (nextFilters) => {
    try {
      setLoading(true);
      setError(null);

      const response = await tourismAPI.getLightTours(buildApiParams(nextFilters));
      setTours(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки туров:', err);
      setError('Ошибка загрузки туров');
      setTours([]);
    } finally {
      setLoading(false);
    }
  }, [buildApiParams]);

  const loadCountries = useCallback(async () => {
    try {
      setCountriesLoading(true);

      const response = await tourismAPI.getLightTours({
        limit: 100,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      const data = response.data || [];
      const uniqueCountries = [...new Set(data.map((tour) => tour.country).filter(Boolean))];
      setCountries(uniqueCountries);
    } catch (err) {
      console.error('Ошибка загрузки списка стран:', err);
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTours(filters);
    }, 350);

    return () => clearTimeout(timer);
  }, [filters, loadTours]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;

    if (filters.search) count += 1;
    if (filters.minPrice) count += 1;
    if (filters.maxPrice) count += 1;
    if (filters.country) count += 1;
    if (filters.startDate) count += 1;
    if (filters.endDate) count += 1;
    if (filters.duration) count += 1;
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) count += 1;
    if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) count += 1;

    return count;
  }, [filters]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  if (loading && tours.length === 0) {
    return (
      <div className="tours-page">
        <div className="page-shell">
          <PageHeroSkeleton />
          <ToursGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (error && tours.length === 0) {
    return (
      <div className="page-shell catalog-page">
        <div className="home-empty" style={{ color: '#dc2626' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell catalog-page">
      <section className="catalog-hero">
        <div>
          <span className="home-hero__eyebrow">Каталог путешествий</span>
          <h1 className="catalog-hero__title">Подберите идеальный тур</h1>
          <p className="catalog-hero__text">
            Фильтруйте направления по цене, датам, длительности и стране.
            Теперь фильтрация и сортировка обрабатываются быстрее на сервере.
          </p>
        </div>

        <div className="catalog-hero__stats">
          <div className="catalog-hero__stat">
            <strong>{tours.length}</strong>
            <span>показано туров</span>
          </div>

          <div className="catalog-hero__stat">
            <strong>{activeFiltersCount}</strong>
            <span>активных фильтров</span>
          </div>
        </div>
      </section>

      <section className="catalog-layout">
        <aside className="catalog-filters">
          <div className="catalog-filters__head">
            <h2>Фильтры</h2>
            <button
              type="button"
              className="catalog-clear"
              onClick={clearFilters}
            >
              Сбросить
            </button>
          </div>

          <div className="catalog-field">
            <label>Поиск</label>
            <input
              type="text"
              placeholder="Название, страна, город..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          <div className="catalog-field">
            <label>Страна</label>
            <select
              value={filters.country}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              disabled={countriesLoading}
            >
              <option value="">Все страны</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog-field-grid">
            <div className="catalog-field">
              <label>Цена от</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
              />
            </div>

            <div className="catalog-field">
              <label>Цена до</label>
              <input
                type="number"
                placeholder="300000"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
              />
            </div>
          </div>

          <div className="catalog-field-grid">
            <div className="catalog-field">
              <label>Дата от</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="catalog-field">
              <label>Дата до</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="catalog-field">
            <label>Длительность</label>
            <select
              value={filters.duration}
              onChange={(e) => handleFilterChange('duration', e.target.value)}
            >
              <option value="">Любая</option>
              <option value="3">3 дня</option>
              <option value="5">5 дней</option>
              <option value="7">7 дней</option>
              <option value="10">10 дней</option>
              <option value="14">14 дней</option>
            </select>
          </div>

          <div className="catalog-field-grid">
            <div className="catalog-field">
              <label>Сортировать по</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <option value="created_at">Дате добавления</option>
                <option value="price">Цене</option>
                <option value="duration">Длительности</option>
                <option value="start_date">Дате начала</option>
                <option value="rating">Рейтингу</option>
                <option value="title">Названию</option>
              </select>
            </div>

            <div className="catalog-field">
              <label>Порядок</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>
            </div>
          </div>
        </aside>

        <div className="catalog-content">
          <div className="catalog-toolbar">
            <div>
              <h2 className="catalog-toolbar__title">Туры</h2>
              <p className="catalog-toolbar__text">
                Найдено: <strong>{tours.length}</strong>
              </p>
            </div>
          </div>

          {loading ? (
            <ToursGridSkeleton count={6} />
          ) : tours.length === 0 ? (
            <div className="home-empty">
              Туры не найдены. Попробуйте изменить параметры фильтрации.
            </div>
          ) : (
            <div className="catalog-grid">
              {tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Tours;