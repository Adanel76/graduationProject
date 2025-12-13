import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TourCard from '../components/TourCard';
import { tourismAPI } from '../services/api';

const Home = () => {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    try {
      const response = await tourismAPI.getTours();
      setTours(response.data.slice(0, 3)); // Первые 3 тура
    } catch (error) {
      console.error('Ошибка загрузки туров:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Загрузка...</div>;
  }

  return (
    <div>
      {/* Hero секция */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Откройте для себя мир</h1>
          <p style={styles.heroText}>Лучшие туры по самым красивым местам планеты</p>
          <Link to="/tours" style={styles.heroButton}>Посмотреть туры</Link>
        </div>
      </section>

      {/* Популярные туры */}
      <section style={styles.container}>
        <h2 style={styles.sectionTitle}>Популярные туры</h2>
        <div style={styles.toursGrid}>
          {tours.map(tour => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      </section>
    </div>
  );
};

const styles = {
  hero: {
    background: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(https://images.unsplash.com/photo-1503220317375-aaad61436b1b) center/cover',
    height: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: 'white',
  },
  heroContent: {
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
   toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '2rem',
    padding: '2rem 0',
  },
  heroText: {
    fontSize: '1.2rem',
    marginBottom: '2rem',
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '2rem',
    padding: '2rem 0',
  },
  heroButton: {
    display: 'inlineBlock',
    backgroundColor: '#3498db',
    color: 'white',
    padding: '12px 30px',
    textDecoration: 'none',
    borderRadius: '5px',
    fontSize: '1rem',
    transition: 'background 0.3s',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
  },
  sectionTitle: {
    textAlign: 'center',
    margin: '2rem 0',
    color: '#2c3e50',
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    padding: '2rem 0',
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
  },
};

export default Home;
