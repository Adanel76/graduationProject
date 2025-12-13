import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';

const AdminTours = () => {
  const navigate = useNavigate();
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTour, setEditingTour] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    duration: '',
    start_date: '',
    end_date: '',
    country: '',
    city: '',
    image_base64: '',
    image_type: '',
    max_people: ''
  });

  useEffect(() => {
    checkAdminAccess();
    loadTours();
  }, []);

  const checkAdminAccess = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
      navigate('/login');
    }
  };

  const loadTours = async () => {
    try {
      const response = await tourismAPI.getTours();
      setTours(response.data);
    } catch (error) {
      console.error('Ошибка загрузки туров:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData({
          ...formData,
          image_base64: event.target.result,
          image_type: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const tourData = {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        max_people: parseInt(formData.max_people),
        program: formData.program || '' // Добавим программу
      };

      // Убираем пустые поля изображения если они не нужны
      if (!tourData.image_base64) {
        delete tourData.image_base64;
        delete tourData.image_type;
      }

      if (editingTour) {
        // Обновление тура
        await tourismAPI.updateTour(editingTour.id, tourData);
      } else {
        // Создание нового тура
        await tourismAPI.createTour(tourData);
      }

      // Сброс формы и обновление списка
      setFormData({
        title: '',
        description: '',
        price: '',
        duration: '',
        start_date: '',
        end_date: '',
        country: '',
        city: '',
        image_base64: '',
        image_type: '',
        max_people: ''
      });
      setShowForm(false);
      setEditingTour(null);
      loadTours();
      
    } catch (error) {
      console.error('Ошибка сохранения тура:', error);
      alert('Ошибка при сохранении тура');
    }
  };

  const handleEdit = (tour) => {
    setEditingTour(tour);
    setFormData({
      title: tour.title,
      description: tour.description,
      price: tour.price.toString(),
      duration: tour.duration.toString(),
      start_date: tour.start_date,
      end_date: tour.end_date,
      country: tour.country,
      city: tour.city,
      image_base64: tour.image_data || '',
      image_type: tour.image_type || '',
      max_people: tour.max_people.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (tourId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот тур?')) {
      try {
        await tourismAPI.deleteTour(tourId);
        loadTours();
      } catch (error) {
        console.error('Ошибка удаления тура:', error);
        alert('Ошибка при удалении тура');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTour(null);
    setFormData({
      title: '',
      description: '',
      price: '',
      duration: '',
      start_date: '',
      end_date: '',
      country: '',
      city: '',
      image_base64: '',
      image_type: '',
      max_people: ''
    });
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          fontSize: '1.2rem',
        }}>Загрузка туров...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1>Управление турами</h1>
        <button 
          onClick={() => navigate('/admin')}
          style={{
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '1rem',
          }}
        >
          Назад
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={() => {
            setShowForm(!showForm);
            setEditingTour(null);
            if (showForm) {
              setFormData({
                title: '',
                description: '',
                price: '',
                duration: '',
                start_date: '',
                end_date: '',
                country: '',
                city: '',
                image_base64: '',
                image_type: '',
                max_people: ''
              });
            }
          }}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          {showForm ? 'Отмена' : 'Добавить тур'}
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
        }}>
          <h2>{editingTour ? 'Редактировать тур' : 'Добавить новый тур'}</h2>
          
          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Название:
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Страна:
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Город:
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Цена (₽):
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Длительность (дней):
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  required
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Максимум человек:
                </label>
                <input
                  type="number"
                  name="max_people"
                  value={formData.max_people}
                  onChange={handleInputChange}
                  required
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Дата начала:
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Дата окончания:
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Описание:
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="4"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Программа тура (подробное описание по дням):
              </label>
              <textarea
                name="program"
                value={formData.program}
                onChange={handleInputChange}
                rows="8"
                placeholder="Укажите подробную программу тура по дням..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Изображение:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '1rem',
                }}
              />
              {formData.image_base64 && (
                <div style={{ marginTop: '1rem' }}>
                  <img 
                    src={formData.image_base64} 
                    alt="Preview" 
                    style={{ maxWidth: '200px', maxHeight: '200px' }}
                  />
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="submit"
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                {editingTour ? 'Обновить тур' : 'Создать тур'}
              </button>
              
              <button 
                type="button"
                onClick={handleCancel}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '2rem',
        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
      }}>
        <h2>Список туров</h2>
        
        {tours.length === 0 ? (
          <p>Нет туров для отображения</p>
        ) : (
          <div style={{
            overflowX: 'auto',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Название</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Место</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Цена</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Длительность</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Даты</th>
                  <th style={{ padding: '1rem', textAlign: 'left', border: '1px solid #ddd' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tours.map(tour => (
                  <tr key={tour.id}>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{tour.id}</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{tour.title}</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{tour.city}, {tour.country}</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{tour.price.toLocaleString('ru-RU')} ₽</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>{tour.duration} дней</td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      {new Date(tour.start_date).toLocaleDateString('ru-RU')} - {new Date(tour.end_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '1rem', border: '1px solid #ddd' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleEdit(tour)}
                          style={{
                            backgroundColor: '#f39c12',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                          }}
                        >
                          Редактировать
                        </button>
                        <button 
                          onClick={() => handleDelete(tour.id)}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTours;