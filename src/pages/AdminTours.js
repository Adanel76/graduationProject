import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tourismAPI } from '../services/api';
import { useToast } from '../components/ToastContext';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import AdminModal from '../components/AdminModal';

const FALLBACK_TOUR_IMAGE = 'https://via.placeholder.com/1200x800?text=Tour';

const createInitialForm = () => ({
  title: '',
  description: '',
  price: '',
  duration: '',
  start_date: '',
  end_date: '',
  country: '',
  city: '',
  max_people: '',
  program: '',
  accommodation: '',
  meals: '',
  meals_features: '',
  activities: '',
  activities_features: '',
  resort_info: '',
  resort_features: '',
  program_details: '',
  hotel_name: '',
  hotel_address: '',
  hotel_description: '',
  hotel_features: '',
  hotel_map_lat: '',
  hotel_map_lng: '',
  hotel_map_zoom: '15',
  map_lat: '',
  map_lng: '',
  map_zoom: '12',
  image_url: '',
  image_base64: '',
  image_type: '',
  remove_image: false,
});

const createInitialGallery = () =>
  Array.from({ length: 4 }, () => ({
    image_url: '',
    image_base64: '',
    image_type: '',
    alt_text: '',
  }));

const normalizeApiError = (error, fallback = 'Произошла ошибка') => {
  const detail = error?.response?.data?.detail;

  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return 'Некорректные данные';
      })
      .join(', ');
  }

  if (typeof detail === 'object') {
    if (detail.msg) return detail.msg;
    if (detail.detail) return normalizeApiError({ response: { data: detail } }, fallback);
  }

  return fallback;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const AdminTours = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirmDialog();

  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [tourStatusFilter, setTourStatusFilter] = useState('active');

  const [selectedTour, setSelectedTour] = useState(null);
  const [modalMode, setModalMode] = useState(null); // null | create | edit
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(createInitialForm());
  const [galleryItems, setGalleryItems] = useState(createInitialGallery());
  const imageFileInputRef = useRef(null);
  const galleryFileInputRefs = useRef([]);
  const csvFileInputRef = useRef(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(() => Date.now());
  const [csvImporting, setCsvImporting] = useState(false);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setPageError('');

      const [meResponse, toursResponse] = await Promise.all([
        tourismAPI.getCurrentUser(),
        tourismAPI.getLightTours({
          limit: 200,
          include_archived: true,
        })
      ]);

      const me = meResponse?.data;

      if (!['admin', 'manager'].includes(me?.role)) {
        navigate('/profile');
        return;
      }

      setTours(Array.isArray(toursResponse?.data) ? toursResponse.data : []);
    } catch (error) {
      console.error('Ошибка загрузки туров:', error);

      if (error?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
        return;
      }

      if (error?.response?.status === 403) {
        navigate('/profile');
        return;
      }

      setPageError(normalizeApiError(error, 'Не удалось загрузить туры'));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const closeModal = useCallback(() => {
    setSelectedTour(null);
    setModalError('');
    setModalMode(null);
    setForm(createInitialForm());
    setGalleryItems(createInitialGallery());
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
    galleryFileInputRefs.current.forEach((input) => {
      if (input) {
        input.value = '';
      }
    });
    setSaving(false);
  }, []);

  const filteredTours = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...tours]
      .filter((tour) => {
        const text = [
          tour.title,
          tour.description,
          tour.country,
          tour.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = normalizedSearch ? text.includes(normalizedSearch) : true;
        const matchesCountry = countryFilter
          ? (tour.country || '').toLowerCase() === countryFilter.toLowerCase()
          : true;
        const matchesStatus =
          tourStatusFilter === 'all'
            ? true
            : tourStatusFilter === 'archived'
            ? Boolean(tour.is_archived)
            : !tour.is_archived;

        return matchesSearch && matchesCountry && matchesStatus;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [tours, search, countryFilter, tourStatusFilter]);

  const stats = useMemo(() => {
    const total = tours.length;

    const avgPrice =
      total > 0
        ? Math.round(
            tours.reduce((sum, item) => sum + Number(item.price || 0), 0) / total
          )
        : 0;

    const avgRating =
      total > 0
        ? (
            tours.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total
          ).toFixed(1)
        : '0.0';

    const upcoming = tours.filter((tour) => {
      if (!tour.start_date) return false;
      return new Date(tour.start_date) >= new Date(new Date().toDateString());
    }).length;

    return { total, avgPrice, avgRating, upcoming };
  }, [tours]);

  const countries = useMemo(() => {
    return [...new Set(tours.map((tour) => tour.country).filter(Boolean))].sort();
  }, [tours]);

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('ru-RU');
  };

  const getImageSrc = (tour) => {
    if (tour?.image_data) {
      return `data:${tour.image_type || 'image/jpeg'};base64,${tour.image_data}`;
    }

    if (tour?.image_url) {
      return tour.image_url;
    }

    if (tour?.id) {
      return tourismAPI.getTourImageUrl(tour.id, `${tour.id}-${imageRefreshKey}`);
    }

    return FALLBACK_TOUR_IMAGE;
  };

  const loadTourGallery = useCallback(async (tourId) => {
    if (!tourId || typeof tourismAPI.getTourGallery !== 'function') {
      return;
    }

    try {
      const response = await tourismAPI.getTourGallery(tourId);
      const items = Array.isArray(response?.data) ? response.data : [];
      const nextGallery = createInitialGallery();

      items.slice(0, nextGallery.length).forEach((item, index) => {
        nextGallery[index] = {
          image_url: item.image_url || '',
          image_base64: item.image_data || '',
          image_type: item.image_type || '',
          alt_text: item.alt_text || '',
        };
      });

      setGalleryItems(nextGallery);
    } catch (error) {
      console.error('Ошибка загрузки галереи тура:', error);
      setGalleryItems(createInitialGallery());
    }
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedTour(null);
    setModalError('');
    setForm(createInitialForm());
    setGalleryItems(createInitialGallery());
  };

  const openEditModal = (tour) => {
    setModalMode('edit');
    setSelectedTour(tour);
    setModalError('');
    setForm({
      title: tour.title || '',
      description: tour.description || '',
      price: tour.price ?? '',
      duration: tour.duration ?? '',
      start_date: toDateInputValue(tour.start_date),
      end_date: toDateInputValue(tour.end_date),
      country: tour.country || '',
      city: tour.city || '',
      max_people: tour.max_people ?? '',
      program: tour.program || '',
      accommodation: tour.accommodation || '',
      meals: tour.meals || '',
      meals_features: tour.meals_features || '',
      activities: tour.activities || '',
      activities_features: tour.activities_features || '',
      resort_info: tour.resort_info || '',
      resort_features: tour.resort_features || '',
      program_details: tour.program_details || '',
      hotel_name: tour.hotel_name || '',
      hotel_address: tour.hotel_address || '',
      hotel_description: tour.hotel_description || '',
      hotel_features: tour.hotel_features || '',
      hotel_map_lat: tour.hotel_map_lat ?? '',
      hotel_map_lng: tour.hotel_map_lng ?? '',
      hotel_map_zoom: tour.hotel_map_zoom ?? '15',
      map_lat: tour.map_lat ?? '',
      map_lng: tour.map_lng ?? '',
      map_zoom: tour.map_zoom ?? '12',
      image_url: tour.image_url || '',
      image_base64: '',
      image_type: '',
      remove_image: false,
    });
    setGalleryItems(createInitialGallery());
    loadTourGallery(tour.id);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageFile = (file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;

      setForm((prev) => ({
        ...prev,
        image_base64: base64,
        image_type: file.type || 'image/jpeg',
        image_url: '',
        remove_image: false,
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleGalleryChange = (index, field, value) => {
    setGalleryItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(field === 'image_url'
                ? { image_base64: '', image_type: '' }
                : {}),
            }
          : item
      )
    );

    if (field === 'image_url' && galleryFileInputRefs.current[index]) {
      galleryFileInputRefs.current[index].value = '';
    }
  };

  const handleGalleryFile = (index, file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;

      setGalleryItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                image_base64: base64,
                image_type: file.type || 'image/jpeg',
                image_url: '',
              }
            : item
        )
      );
    };

    reader.readAsDataURL(file);
  };

  const clearGalleryItem = (index) => {
    if (galleryFileInputRefs.current[index]) {
      galleryFileInputRefs.current[index].value = '';
    }

    setGalleryItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              image_url: '',
              image_base64: '',
              image_type: '',
              alt_text: '',
            }
          : item
      )
    );
  };

  const getGalleryPreview = (item) => {
    if (item?.image_base64) {
      return `data:${item.image_type || 'image/jpeg'};base64,${item.image_base64}`;
    }

    return item?.image_url || FALLBACK_TOUR_IMAGE;
  };

  const buildGalleryPayload = (tourTitle) => ({
    images: galleryItems
      .map((item, index) => ({
        image_url: item.image_base64 ? null : item.image_url.trim() || null,
        image_base64: item.image_base64 || null,
        image_type: item.image_base64 ? item.image_type || 'image/jpeg' : null,
        alt_text: item.alt_text.trim() || `${tourTitle || form.title || 'Тур'} — фото ${index + 1}`,
        sort_order: index,
      }))
      .filter((item) => item.image_url || item.image_base64),
  });

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      duration: Number(form.duration),
      start_date: form.start_date,
      end_date: form.end_date,
      country: form.country.trim(),
      city: form.city.trim(),
      max_people: Number(form.max_people),
      program: form.program.trim() || null,
      accommodation: form.accommodation.trim() || null,
      meals: form.meals.trim() || null,
      meals_features: form.meals_features.trim() || null,
      activities: form.activities.trim() || null,
      activities_features: form.activities_features.trim() || null,
      resort_info: form.resort_info.trim() || null,
      resort_features: form.resort_features.trim() || null,
      program_details: form.program_details.trim() || null,
      hotel_name: form.hotel_name.trim() || null,
      hotel_address: form.hotel_address.trim() || null,
      hotel_description: form.hotel_description.trim() || null,
      hotel_features: form.hotel_features.trim() || null,
      hotel_map_lat: form.hotel_map_lat === '' ? null : Number(form.hotel_map_lat),
      hotel_map_lng: form.hotel_map_lng === '' ? null : Number(form.hotel_map_lng),
      hotel_map_zoom: form.hotel_map_zoom === '' ? 15 : Number(form.hotel_map_zoom),
      map_lat: form.map_lat === '' ? null : Number(form.map_lat),
      map_lng: form.map_lng === '' ? null : Number(form.map_lng),
      map_zoom: form.map_zoom === '' ? 12 : Number(form.map_zoom),
    };

    if (modalMode === 'create') {
      payload.image_url = form.image_base64 ? null : form.image_url.trim() || null;
      payload.image_base64 = form.image_base64 || null;
      payload.image_type = form.image_base64 ? form.image_type || 'image/jpeg' : null;
      return payload;
    }

    if (form.remove_image) {
      payload.remove_image = true;
      payload.image_url = null;
      payload.image_base64 = null;
      payload.image_type = null;
      return payload;
    }

    if (form.image_base64) {
      payload.image_base64 = form.image_base64;
      payload.image_type = form.image_type || 'image/jpeg';
      payload.image_url = null;
      return payload;
    }

    const initialImageUrl = selectedTour?.image_url || '';
    const nextImageUrl = form.image_url.trim();
    if (nextImageUrl !== initialImageUrl) {
      payload.image_url = nextImageUrl || null;
    }

    return payload;
  };

  const validateForm = () => {
    if (!form.title.trim()) return 'Введите название тура';
    if (!form.price || Number(form.price) <= 0) return 'Укажите корректную стоимость';
    if (!form.duration || Number(form.duration) <= 0) return 'Укажите длительность';
    if (!form.start_date) return 'Укажите дату начала';
    if (!form.end_date) return 'Укажите дату окончания';
    if (new Date(form.end_date) < new Date(form.start_date)) {
      return 'Дата окончания не может быть раньше даты начала';
    }
    if (!form.country.trim()) return 'Укажите страну';
    if (!form.city.trim()) return 'Укажите город';
    if (!form.max_people || Number(form.max_people) <= 0) {
      return 'Укажите максимальное количество человек';
    }
    const hasLat = form.map_lat !== '';
    const hasLng = form.map_lng !== '';
    if (hasLat !== hasLng) return 'Для точки на карте укажите и широту, и долготу';
    if (hasLat && (!Number.isFinite(Number(form.map_lat)) || !Number.isFinite(Number(form.map_lng)))) {
      return 'Координаты карты должны быть числами';
    }
    if (form.map_zoom !== '' && (!Number.isFinite(Number(form.map_zoom)) || Number(form.map_zoom) < 2 || Number(form.map_zoom) > 18)) {
      return 'Масштаб карты должен быть от 2 до 18';
    }

    const hasHotelLat = form.hotel_map_lat !== '';
    const hasHotelLng = form.hotel_map_lng !== '';
    if (hasHotelLat !== hasHotelLng) return 'Для точки отеля укажите и широту, и долготу';
    if (
      hasHotelLat &&
      (!Number.isFinite(Number(form.hotel_map_lat)) || !Number.isFinite(Number(form.hotel_map_lng)))
    ) {
      return 'Координаты отеля должны быть числами';
    }
    if (
      form.hotel_map_zoom !== '' &&
      (!Number.isFinite(Number(form.hotel_map_zoom)) || Number(form.hotel_map_zoom) < 2 || Number(form.hotel_map_zoom) > 18)
    ) {
      return 'Масштаб карты отеля должен быть от 2 до 18';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validateForm();

    if (validationError) {
      setModalError(validationError);
      return;
    }

    try {
      setSaving(true);
      setModalError('');

      const payload = buildPayload();

      if (modalMode === 'create') {
        const response = await tourismAPI.createTour(payload);

        if (typeof tourismAPI.replaceTourGallery === 'function') {
          await tourismAPI.replaceTourGallery(
            response.data.id,
            buildGalleryPayload(response.data.title)
          );
        }

        setTours((prev) => [response.data, ...prev]);
        setImageRefreshKey(Date.now());
        toast.success('Тур успешно создан');
      } else if (modalMode === 'edit' && selectedTour) {
        const response = await tourismAPI.updateTour(selectedTour.id, payload);

        if (typeof tourismAPI.replaceTourGallery === 'function') {
          await tourismAPI.replaceTourGallery(
            selectedTour.id,
            buildGalleryPayload(response.data.title)
          );
        }

        setTours((prev) =>
          prev.map((item) => (item.id === selectedTour.id ? response.data : item))
        );
        setImageRefreshKey(Date.now());
        toast.success('Изменения по туру сохранены');
      }

      closeModal();
    } catch (error) {
      console.error('Ошибка сохранения тура:', error);
      setModalError(normalizeApiError(error, 'Не удалось сохранить тур'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tourId) => {
    const confirmed = await confirm({
      title: 'Удалить тур?',
      message:
        'Тур будет удалён из каталога. Это действие может затронуть связанные записи.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      await tourismAPI.deleteTour(tourId);
      setTours((prev) => prev.filter((item) => item.id !== tourId));
      toast.success('Тур удалён');

      if (selectedTour?.id === tourId) {
        closeModal();
      }
    } catch (error) {
      console.error('Ошибка удаления тура:', error);
      setModalError(normalizeApiError(error, 'Не удалось удалить тур'));
    }
  };


  const handleToursCsvImport = async (file) => {
    if (!file) return;

    try {
      setCsvImporting(true);
      setPageError('');
      const response = await tourismAPI.importToursCsv(file);
      const result = response?.data || {};
      toast.success(`CSV обработан: создано ${result.created || 0}, пропущено ${result.skipped || 0}`);

      if (Array.isArray(result.errors) && result.errors.length > 0) {
        setPageError(`CSV импортирован частично. Ошибки: ${result.errors.slice(0, 5).join(' | ')}`);
      }

      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = '';
      }

      await loadPage();
    } catch (error) {
      console.error('Ошибка импорта туров из CSV:', error);
      const message = normalizeApiError(error, 'Не удалось импортировать туры из CSV');
      setPageError(message);
      toast.error(message);
    } finally {
      setCsvImporting(false);
    }
  };

  const handleDownloadTourTemplate = async () => {
    try {
      await tourismAPI.downloadTourCsvTemplate();
    } catch (error) {
      console.error('Ошибка скачивания шаблона CSV:', error);
      setPageError(normalizeApiError(error, 'Не удалось скачать шаблон CSV'));
    }
  };

  const handleDownloadToursCsv = async () => {
    try {
      setPageError('');
      await tourismAPI.downloadToursCsv({
        search,
        country: countryFilter,
        tour_status: tourStatusFilter,
      });
      toast.success('CSV-файл с турами скачан');
    } catch (error) {
      console.error('Ошибка экспорта туров в CSV:', error);
      const message = normalizeApiError(error, 'Не удалось скачать туры в CSV');
      setPageError(message);
      toast.error(message);
    }
  };

  const handleDownloadSingleTourCsv = async (tourId) => {
    try {
      setPageError('');
      await tourismAPI.downloadTourCsv(tourId);
      toast.success('CSV-файл тура скачан');
    } catch (error) {
      console.error('Ошибка экспорта тура в CSV:', error);
      const message = normalizeApiError(error, 'Не удалось скачать тур в CSV');
      setPageError(message);
      toast.error(message);
    }
  };

  const previewImage = form.remove_image
    ? FALLBACK_TOUR_IMAGE
    : form.image_base64
    ? `data:${form.image_type || 'image/jpeg'};base64,${form.image_base64}`
    : form.image_url || (selectedTour ? getImageSrc(selectedTour) : FALLBACK_TOUR_IMAGE);

  if (loading) {
    return (
      <div className="admin-tours-page">
        <div className="page-shell">
          <div className="home-empty">Загрузка туров...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tours-page">
      <div className="page-shell">
        <section className="admin-tours-hero motion-rise">
          <div>
            <span className="home-hero__eyebrow">Tours / Catalog management</span>
            <h1 className="admin-tours-hero__title">Управление турами</h1>
            <p className="admin-tours-hero__text">
              Полноценная CRUD-панель для каталога туров: создание, редактирование,
              обновление контента и контроль карточек каталога.
            </p>
          </div>

          <div className="admin-tours-hero__stats">
            <div className="compact-stat">
              <span>Всего туров</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="compact-stat">
              <span>Средняя цена</span>
              <strong>{formatMoney(stats.avgPrice)}</strong>
            </div>
            <div className="compact-stat">
              <span>Средний рейтинг</span>
              <strong>{stats.avgRating}</strong>
            </div>
            <div className="compact-stat">
              <span>Предстоящие</span>
              <strong>{stats.upcoming}</strong>
            </div>
          </div>
        </section>

        <section className="admin-tours-toolbar motion-fade">
          <div className="admin-tours-toolbar__left">
            <input
              type="text"
              className="admin-table-search"
              placeholder="Поиск по названию, описанию, стране, городу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-tours-toolbar__right">
            <select
              className="admin-tours-select"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
            >
              <option value="">Все страны</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>

            <select
              className="admin-tours-select"
              value={tourStatusFilter}
              onChange={(e) => setTourStatusFilter(e.target.value)}
            >
              <option value="active">Активные туры</option>
              <option value="archived">Архивные туры</option>
              <option value="all">Все туры</option>
            </select>

            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={() => {
                setSearch('');
                setCountryFilter('');
                setTourStatusFilter('active');
              }}
            >
              Сбросить
            </button>

            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={handleDownloadTourTemplate}
            >
              Шаблон CSV
            </button>

            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={handleDownloadToursCsv}
            >
              Скачать CSV
            </button>

            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(event) => handleToursCsvImport(event.target.files?.[0])}
            />

            <button
              type="button"
              className="site-button site-button--midnight"
              onClick={() => csvFileInputRef.current?.click()}
              disabled={csvImporting}
            >
              {csvImporting ? 'Импорт...' : 'Создать из CSV'}
            </button>

            <button
              type="button"
              className="site-button site-button--primary"
              onClick={openCreateModal}
            >
              Создать тур
            </button>
          </div>
        </section>

        {pageError && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '18px' }}>
            {pageError}
          </div>
        )}

        <section className="admin-table-shell motion-fade">
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Тур</th>
                  <th>Локация</th>
                  <th>Даты</th>
                  <th>Цена</th>
                  <th>Длительность</th>
                  <th>Места</th>
                  <th>Рейтинг</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {filteredTours.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="admin-tours-empty-row">
                        Туры по заданным фильтрам не найдены
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTours.map((tour) => (
                    <tr key={tour.id}>
                      <td>
                        <div className="admin-tours-item">
                          <img
                            src={getImageSrc(tour)}
                            alt={tour.title}
                            className="admin-tours-item__image"
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                            }}
                          />
                          <div>
                            <strong>{tour.title}</strong>
                            <span>{tour.description || 'Описание отсутствует'}</span>
                            {tour.is_archived ? <span className="ui-chip ui-chip--danger">Архив</span> : null}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="admin-tours-meta">
                          <strong>{tour.country || '—'}</strong>
                          <span>{tour.city || '—'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="admin-tours-meta">
                          <strong>{formatDate(tour.start_date)}</strong>
                          <span>до {formatDate(tour.end_date)}</span>
                        </div>
                      </td>

                      <td>{formatMoney(tour.price)}</td>
                      <td>{tour.duration || '—'} дн.</td>
                      <td>{tour.available_seats ?? tour.max_people ?? '—'} / {tour.max_people || '—'}</td>
                      <td>{Number(tour.rating || 0).toFixed(1)}</td>

                      <td>
                        <div className="admin-tours-actions">
                          <button
                            type="button"
                            className="site-button site-button--secondary"
                            onClick={() => openEditModal(tour)}
                          >
                            Открыть
                          </button>

                          <button
                            type="button"
                            className="site-button site-button--ghost"
                            onClick={() => navigate(`/tours/${tour.id}`)}
                          >
                            Просмотр
                          </button>

                          <button
                            type="button"
                            className="site-button site-button--ghost"
                            onClick={() => handleDownloadSingleTourCsv(tour.id)}
                          >
                            CSV
                          </button>

                          <button
                            type="button"
                            className="site-button site-button--danger"
                            onClick={() => handleDelete(tour.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AdminModal
        open={Boolean(modalMode)}
        onClose={closeModal}
        title={
          modalMode === 'create'
            ? 'Создание тура'
            : selectedTour
            ? `Редактирование тура #${selectedTour.id}`
            : 'Редактирование тура'
        }
        size="drawer"
      >
        <div className="admin-tours-drawer__section">
          <span className="home-hero__eyebrow">
            {modalMode === 'create' ? 'Create tour' : 'Edit tour'}
          </span>
          <p
            className="site-muted"
            style={{ marginTop: '12px', marginBottom: 0, lineHeight: 1.7 }}
          >
            Заполните основные поля карточки, контент и изображение.
          </p>
        </div>

        {modalError && (
          <div className="detail-alert detail-alert--error" style={{ marginBottom: '16px' }}>
            {modalError}
          </div>
        )}

        <div className="admin-tours-drawer__grid">
          <div className="ui-field">
            <label>Название</label>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Цена</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => handleChange('price', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Страна</label>
            <input
              value={form.country}
              onChange={(e) => handleChange('country', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Город / курорт</label>
            <input
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Дата начала</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Дата окончания</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Длительность (дней)</label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => handleChange('duration', e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label>Максимум человек</label>
            <input
              type="number"
              value={form.max_people}
              onChange={(e) => handleChange('max_people', e.target.value)}
            />
          </div>
        </div>

        <div className="admin-tours-drawer__section">
          <div className="ui-field">
            <label>Краткое описание</label>
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>
        </div>

        <div className="admin-tours-map-settings admin-tours-content-section">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Программа тура</h3>
              <p className="site-muted">
                Эти поля формируют основной текст страницы тура и блок «Подробности программы».
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Краткая программа</label>
              <textarea
                rows="5"
                placeholder="Опишите маршрут, основные дни поездки и общий сценарий тура."
                value={form.program}
                onChange={(e) => handleChange('program', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Подробности программы</label>
              <textarea
                rows="5"
                placeholder="Можно расписать программу подробнее: дни, переезды, экскурсии, свободное время."
                value={form.program_details}
                onChange={(e) => handleChange('program_details', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-tours-map-settings">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Проживание и отель</h3>
              <p className="site-muted">
                Эти данные используются в блоке «Проживание»: карта отеля, адрес, описание и характеристики.
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Название отеля</label>
              <input
                placeholder="Например: Grand Hotel Sochi"
                value={form.hotel_name}
                onChange={(e) => handleChange('hotel_name', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Адрес отеля</label>
              <input
                placeholder="Например: г. Сочи, Курортный проспект, 50"
                value={form.hotel_address}
                onChange={(e) => handleChange('hotel_address', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Описание отеля</label>
              <textarea
                rows="5"
                placeholder="Кратко опишите размещение, номерной фонд, расположение и условия заселения."
                value={form.hotel_description}
                onChange={(e) => handleChange('hotel_description', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Условия проживания / важно</label>
              <textarea
                rows="5"
                placeholder="Например: тип размещения, условия заселения, возможные доплаты, особенности номеров."
                value={form.accommodation}
                onChange={(e) => handleChange('accommodation', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Характеристики отеля</label>
              <textarea
                rows="5"
                placeholder={'Каждую характеристику лучше писать с новой строки:\nзавтрак включён\n500 м до моря\nWi‑Fi на территории'}
                value={form.hotel_features}
                onChange={(e) => handleChange('hotel_features', e.target.value)}
              />
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Широта отеля</label>
              <input
                type="number"
                step="any"
                placeholder="Например: 43.585472"
                value={form.hotel_map_lat}
                onChange={(e) => handleChange('hotel_map_lat', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Долгота отеля</label>
              <input
                type="number"
                step="any"
                placeholder="Например: 39.723098"
                value={form.hotel_map_lng}
                onChange={(e) => handleChange('hotel_map_lng', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Масштаб карты отеля</label>
              <input
                type="number"
                min="2"
                max="18"
                value={form.hotel_map_zoom}
                onChange={(e) => handleChange('hotel_map_zoom', e.target.value)}
              />
            </div>

            <div className="ui-field admin-tours-image-tools">
              <label>Управление точкой отеля</label>
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => {
                  handleChange('hotel_map_lat', '');
                  handleChange('hotel_map_lng', '');
                  handleChange('hotel_map_zoom', '15');
                }}
              >
                Очистить точку отеля
              </button>
            </div>
          </div>

          <div className="admin-tours-map-preview">
            <iframe
              title="Предпросмотр отеля на карте"
              src={
                form.hotel_map_lat && form.hotel_map_lng
                  ? `https://yandex.ru/map-widget/v1/?ll=${form.hotel_map_lng},${form.hotel_map_lat}&z=${form.hotel_map_zoom || 15}&pt=${form.hotel_map_lng},${form.hotel_map_lat},pm2rdm`
                  : `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent([form.hotel_address, form.hotel_name, form.city, form.country, 'отель'].filter(Boolean).join(', '))}&z=${form.hotel_map_zoom || 15}`
              }
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>

        <div className="admin-tours-map-settings admin-tours-content-section">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Питание</h3>
              <p className="site-muted">
                Заполните описание питания и список важных особенностей. Эти данные отображаются при выборе карточки «Питание».
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Описание программы питания</label>
              <textarea
                rows="5"
                placeholder="Например: завтраки включены, обеды по маршруту, ужины в отеле или свободный выбор ресторанов."
                value={form.meals}
                onChange={(e) => handleChange('meals', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Особенности питания</label>
              <textarea
                rows="5"
                placeholder={'Каждый пункт с новой строки:\nзавтраки включены\nвозможен детский рацион\nдополнительные напитки оплачиваются отдельно'}
                value={form.meals_features}
                onChange={(e) => handleChange('meals_features', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-tours-map-settings admin-tours-content-section">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Активности</h3>
              <p className="site-muted">
                Опишите экскурсии, свободное время и условия участия. Эти данные отображаются при выборе карточки «Активности».
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Описание программы активностей</label>
              <textarea
                rows="5"
                placeholder="Например: обзорная экскурсия, прогулки, посещение достопримечательностей, свободный день."
                value={form.activities}
                onChange={(e) => handleChange('activities', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Особенности активностей</label>
              <textarea
                rows="5"
                placeholder={'Каждый пункт с новой строки:\nчасть экскурсий зависит от погоды\nвходные билеты оплачиваются отдельно\nпрограмма может уточняться менеджером'}
                value={form.activities_features}
                onChange={(e) => handleChange('activities_features', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-tours-map-settings admin-tours-content-section">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>О курорте</h3>
              <p className="site-muted">
                Добавьте ключевую информацию о выбранном курорте: сезонность, особенности отдыха, рекомендации и важные условия.
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Ключевая информация о курорте</label>
              <textarea
                rows="5"
                placeholder="Например: климат, сезон, инфраструктура, кому подойдёт направление, особенности въезда или трансфера."
                value={form.resort_info}
                onChange={(e) => handleChange('resort_info', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Особенности курорта</label>
              <textarea
                rows="5"
                placeholder={'Каждый пункт с новой строки:\nподходит для семейного отдыха\nлучший сезон — май-сентябрь\nрекомендуется удобная обувь для экскурсий'}
                value={form.resort_features}
                onChange={(e) => handleChange('resort_features', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="admin-tours-map-settings">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Точка на Яндекс.Картах</h3>
              <p className="site-muted">
                Менеджер или администратор задаёт координаты тура. Их можно скопировать из Яндекс.Карт: сначала широта, затем долгота.
              </p>
            </div>
          </div>

          <div className="admin-tours-drawer__grid">
            <div className="ui-field">
              <label>Широта</label>
              <input
                type="number"
                step="any"
                placeholder="Например: 55.755864"
                value={form.map_lat}
                onChange={(e) => handleChange('map_lat', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Долгота</label>
              <input
                type="number"
                step="any"
                placeholder="Например: 37.617698"
                value={form.map_lng}
                onChange={(e) => handleChange('map_lng', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label>Масштаб карты</label>
              <input
                type="number"
                min="2"
                max="18"
                value={form.map_zoom}
                onChange={(e) => handleChange('map_zoom', e.target.value)}
              />
            </div>

            <div className="ui-field admin-tours-image-tools">
              <label>Управление точкой</label>
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => {
                  handleChange('map_lat', '');
                  handleChange('map_lng', '');
                  handleChange('map_zoom', '12');
                }}
              >
                Очистить точку
              </button>
            </div>
          </div>

          <div className="admin-tours-map-preview">
            <iframe
              title="Предпросмотр точки на карте"
              src={
                form.map_lat && form.map_lng
                  ? `https://yandex.ru/map-widget/v1/?ll=${form.map_lng},${form.map_lat}&z=${form.map_zoom || 12}&pt=${form.map_lng},${form.map_lat},pm2rdm`
                  : `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent([form.city, form.country].filter(Boolean).join(', '))}&z=${form.map_zoom || 12}`
              }
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>

        <div className="admin-tours-drawer__media">
          <div className="ui-field">
            <label>URL изображения</label>
            <input
              value={form.image_url}
              onChange={(e) => {
                const nextUrl = e.target.value;
                if (imageFileInputRef.current) {
                  imageFileInputRef.current.value = '';
                }
                setForm((prev) => ({
                  ...prev,
                  image_url: nextUrl,
                  image_base64: '',
                  image_type: '',
                  remove_image: false,
                }));
              }}
            />
          </div>

          <div className="ui-field">
            <label>Загрузить файл</label>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
          </div>

          <div className="ui-field admin-tours-image-tools">
            <label>Управление изображением</label>
            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={() => {
                if (imageFileInputRef.current) {
                  imageFileInputRef.current.value = '';
                }
                setForm((prev) => ({
                  ...prev,
                  image_url: '',
                  image_base64: '',
                  image_type: '',
                  remove_image: true,
                }));
              }}
            >
              Очистить изображение
            </button>
          </div>
        </div>

        <div className="admin-tours-gallery-manager">
          <div className="admin-tours-gallery-manager__head">
            <div>
              <h3>Галерея тура</h3>
              <p className="site-muted">
                Добавьте до 4 дополнительных изображений для слайдера на странице тура.
              </p>
            </div>
          </div>

          <div className="admin-tours-gallery-grid">
            {galleryItems.map((item, index) => (
              <div className="admin-tours-gallery-item" key={`gallery-${index}`}>
                <img
                  src={getGalleryPreview(item)}
                  alt={`Фото тура ${index + 1}`}
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                  }}
                />

                <div className="ui-field">
                  <label>URL фото #{index + 1}</label>
                  <input
                    value={item.image_url}
                    onChange={(e) =>
                      handleGalleryChange(index, 'image_url', e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="ui-field">
                  <label>Файл фото #{index + 1}</label>
                  <input
                    ref={(element) => {
                      galleryFileInputRefs.current[index] = element;
                    }}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleGalleryFile(index, e.target.files?.[0])}
                  />
                </div>

                <div className="ui-field">
                  <label>Описание изображения</label>
                  <input
                    value={item.alt_text}
                    onChange={(e) =>
                      handleGalleryChange(index, 'alt_text', e.target.value)
                    }
                    placeholder="Например: вид на отель"
                  />
                </div>

                <button
                  type="button"
                  className="site-button site-button--secondary"
                  onClick={() => clearGalleryItem(index)}
                >
                  Очистить фото
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-tours-preview">
          <img
            src={previewImage}
            alt="Preview"
            className="admin-tours-preview__image"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_TOUR_IMAGE;
            }}
          />
        </div>

        <div className="admin-tours-drawer__actions">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {modalMode === 'edit' && selectedTour ? (
              <button
                type="button"
                className="site-button site-button--ghost"
                onClick={() => navigate(`/tours/${selectedTour.id}`)}
                disabled={saving}
              >
                Открыть страницу тура
              </button>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {modalMode === 'edit' && selectedTour ? (
              <button
                type="button"
                className="site-button site-button--danger"
                onClick={() => handleDelete(selectedTour.id)}
                disabled={saving}
              >
                Удалить тур
              </button>
            ) : null}

            <button
              type="button"
              className="site-button site-button--secondary"
              onClick={closeModal}
              disabled={saving}
            >
              Отмена
            </button>

            <button
              type="button"
              className="site-button site-button--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? 'Сохранение...'
                : modalMode === 'create'
                ? 'Создать тур'
                : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
};

export default AdminTours;