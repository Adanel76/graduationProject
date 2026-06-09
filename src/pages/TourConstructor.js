import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FALLBACK_TOUR_IMAGE,
  getTourCardImageSrc,
  resolveMediaUrl,
  tourismAPI,
} from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/ToastContext';

const SAVED_PLAN_KEY = 'tourConstructorPlan';

const getSavedPlanKey = (userId) => `${SAVED_PLAN_KEY}:${userId}`;

const PACE_LABELS = {
  relaxed: 'Спокойный',
  balanced: 'Сбалансированный',
  active: 'Активный',
};

const INTEREST_LABELS = {
  culture: 'Культура',
  nature: 'Природа',
  family: 'Семейный отдых',
  gastro: 'Гастрономия',
};

const PACKAGE_PRESETS = {
  standard: {
    title: 'Базовый',
    description: 'Выбранные туры и программа без дополнительного сервиса.',
    services: {
      meal_plan: 'none',
      hotel_level: 'base',
      transfer: 'none',
      insurance: false,
      guide: false,
      excursions: false,
      priority_support: false,
    },
  },
  comfort: {
    title: 'Комфорт',
    description: 'Завтраки, комфортное размещение и групповой трансфер.',
    services: {
      meal_plan: 'breakfast',
      hotel_level: 'comfort',
      transfer: 'group',
      insurance: false,
      guide: false,
      excursions: false,
      priority_support: false,
    },
  },
  all_inclusive: {
    title: 'Всё включено',
    description: 'Полное питание, премиум-размещение и индивидуальный трансфер.',
    services: {
      meal_plan: 'all_inclusive',
      hotel_level: 'premium',
      transfer: 'individual',
      insurance: false,
      guide: false,
      excursions: false,
      priority_support: false,
    },
  },
  custom: {
    title: 'Свой пакет',
    description: 'Настройте каждую услугу вручную под бюджет и формат поездки.',
    services: null,
  },
};

const MEAL_RATES = {
  none: 0,
  breakfast: 1200,
  half_board: 2400,
  full_board: 3600,
  all_inclusive: 4600,
};

const HOTEL_RATES = {
  base: 0,
  comfort: 1800,
  premium: 3800,
};

const TRANSFER_RATES = {
  none: 0,
  group: 1800,
  individual: 6500,
};

const MEAL_LABELS = {
  none: 'без питания',
  breakfast: 'завтраки',
  half_board: 'завтрак и ужин',
  full_board: 'трёхразовое питание',
  all_inclusive: 'всё включено',
};

const HOTEL_LABELS = {
  base: 'базовое размещение',
  comfort: 'комфортное размещение',
  premium: 'премиум-размещение',
};

const TRANSFER_LABELS = {
  none: 'трансфер не включён',
  group: 'групповой трансфер',
  individual: 'индивидуальный трансфер',
};

const PACKAGE_LABELS = Object.fromEntries(
  Object.entries(PACKAGE_PRESETS).map(([key, value]) => [key, value.title])
);

const getCityId = (country, city) => `${country || 'country'}::${city || 'city'}`;

const formatMoney = (value) => {
  const number = Number(value || 0);
  if (!number) return 'по запросу';
  return `${number.toLocaleString('ru-RU')} ₽`;
};

const formatPrice = (value) => {
  const number = Number(value || 0);
  if (!number) return 'по запросу';
  return `от ${formatMoney(number)}`;
};

const formatDate = (value) => {
  if (!value) return 'дата уточняется';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'дата уточняется';

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  });
};

const formatDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return 'даты уточняются';
  if (!endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

const normalizeOptionalDateTime = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00`;
  return text;
};

const getEventTypeLabel = (value) => {
  switch (value) {
    case 'promo':
      return 'Акция';
    case 'webinar':
      return 'Встреча';
    case 'update':
      return 'Обновление';
    case 'news':
      return 'Событие';
    default:
      return 'Мероприятие';
  }
};

const getEventImageSrc = (event) => {
  if (event?.image_url) {
    return resolveMediaUrl(event.image_url);
  }

  if (event?.image_data) {
    if (String(event.image_data).startsWith('data:')) {
      return event.image_data;
    }

    return `data:${event.image_type || 'image/jpeg'};base64,${event.image_data}`;
  }

  return '';
};

const normalizeApiError = (error, fallback = 'Не удалось выполнить операцию') => {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== 'body').join(' → ')
          : '';
        const message = item?.msg || item?.detail || 'Некорректные данные';
        return field ? `${field}: ${message}` : message;
      })
      .join('. ');
  }

  if (typeof detail === 'object') {
    return detail.msg || detail.message || detail.detail || fallback;
  }

  return fallback;
};

const splitActivities = (value) => {
  return String(value || '')
    .split(/\n|;|•/)
    .map((item) => item.replace(/^[-–—]\s*/, '').trim())
    .filter((item) => item.length > 2)
    .slice(0, 8);
};

const getBestTour = (tours = []) => {
  return [...tours].sort((a, b) => {
    const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(a.price || 0) - Number(b.price || 0);
  })[0] || null;
};

const getMinTourPrice = (tours = []) => {
  const prices = tours
    .map((tour) => Number(tour.price || 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);

  return prices[0] || 0;
};

const capitalizeText = (value) => {
  const text = String(value || '').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
};

const parseProgramDays = (value) => {
  return String(value || '')
    .split(/\n+|(?=День\s+\d+\s*[—–:-])/iu)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const cleaned = item
        .replace(/^День\s+\d+\s*[—–:-]?\s*/iu, '')
        .replace(/^[-–—]\s*/, '')
        .trim();
      const firstSentence = cleaned.split(/[.!?]\s/)[0].trim();

      return {
        title: capitalizeText(firstSentence.slice(0, 180)) || 'Программа дня',
        description: cleaned || 'Программа уточняется.',
      };
    })
    .slice(0, 60);
};

const getServiceSummary = (services) => {
  const options = [
    MEAL_LABELS[services.meal_plan],
    HOTEL_LABELS[services.hotel_level],
    TRANSFER_LABELS[services.transfer],
  ].filter(Boolean);

  return options.join(', ');
};

const buildSuggestedProgram = (selectedTours, selectedActivities, services) => {
  const days = [];

  selectedTours.forEach(({ city, tour, customization }) => {
    if (days.length >= 60) return;

    const duration = Math.min(
      Math.max(Number(customization?.duration || tour?.duration || 2), 1),
      14
    );
    const programDays = parseProgramDays(
      [tour?.program, tour?.program_details].filter(Boolean).join('\n')
    );
    const cityActivities = selectedActivities.filter((activity) => activity.cityId === city.id);

    for (let index = 0; index < duration && days.length < 60; index += 1) {
      const programDay = programDays[index] || null;
      const activity = cityActivities.length
        ? cityActivities[index % cityActivities.length]
        : null;
      const descriptionParts = [];
      let title = programDay?.title || activity?.title || `Знакомство с городом ${city.name}`;

      if (index === 0) {
        title = programDay?.title || `Прибытие в ${city.name}`;
        if (!programDay) {
          descriptionParts.push(
            `Прибытие в ${city.name}, встреча, ${TRANSFER_LABELS[services.transfer]} и размещение.`
          );
        } else {
          descriptionParts.push(
            `Организация поездки: ${TRANSFER_LABELS[services.transfer]} и размещение.`
          );
        }
        descriptionParts.push(`Выбранный пакет: ${getServiceSummary(services)}.`);
        if (customization?.note) {
          descriptionParts.push(`Пожелания к базовому туру: ${customization.note}.`);
        }
      }

      if (programDay?.description) {
        descriptionParts.push(programDay.description);
      }

      if (activity && !programDay?.description?.toLowerCase().includes(activity.title.toLowerCase())) {
        descriptionParts.push(`${activity.title}. ${activity.description || ''}`.trim());
      }

      if (!programDay && !activity) {
        descriptionParts.push('Свободное время и самостоятельное знакомство с городом.');
      }

      if (index === duration - 1 && duration > 1) {
        if (!programDay) title = `Завершение этапа в ${city.name}`;
        descriptionParts.push('Подведение итогов дня и подготовка к следующему этапу маршрута.');
      }

      days.push({
        id: `${city.id}-${index}-${days.length}`,
        city: city.name,
        title,
        description: descriptionParts.join(' ').trim(),
        source: tour?.title || 'Индивидуальная программа',
      });
    }
  });

  return days;
};

const TourConstructor = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCityIds, setSelectedCityIds] = useState([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [selectedTourByCity, setSelectedTourByCity] = useState({});
  const [tourCustomizationByCity, setTourCustomizationByCity] = useState({});
  const [draggedCityId, setDraggedCityId] = useState('');
  const [packageType, setPackageType] = useState('comfort');
  const [services, setServices] = useState({ ...PACKAGE_PRESETS.comfort.services });
  const [programDays, setProgramDays] = useState([]);
  const [expandedProgramDayIds, setExpandedProgramDayIds] = useState(() => new Set());
  const [programCustomized, setProgramCustomized] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [planId, setPlanId] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [settings, setSettings] = useState({
    people: 2,
    budget: '',
    pace: 'balanced',
    interest: 'culture',
  });

  const loadConstructorData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [toursResponse, eventsResponse] = await Promise.all([
        tourismAPI.getTours({
          limit: 200,
          include_image_data: false,
          include_gallery: true,
          include_archived: false,
          sort_by: 'created_at',
          sort_order: 'desc',
        }),
        tourismAPI.getEvents({ limit: 100 }),
      ]);

      setTours(Array.isArray(toursResponse.data) ? toursResponse.data : []);
      setEvents(Array.isArray(eventsResponse.data) ? eventsResponse.data : []);
    } catch (err) {
      console.error('Ошибка загрузки данных конструктора:', err);
      setTours([]);
      setEvents([]);
      setError('Не удалось загрузить направления для конструктора');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConstructorData();
  }, [loadConstructorData]);

  const countries = useMemo(() => {
    const countryMap = new Map();

    tours.forEach((tour) => {
      if (!tour.country) return;

      const current = countryMap.get(tour.country) || {
        name: tour.country,
        tours: [],
        events: [],
      };
      current.tours.push(tour);
      countryMap.set(tour.country, current);
    });

    events.forEach((event) => {
      if (!event.country) return;

      const current = countryMap.get(event.country) || {
        name: event.country,
        tours: [],
        events: [],
      };
      current.events.push(event);
      countryMap.set(event.country, current);
    });

    return Array.from(countryMap.values()).sort((a, b) => {
      const offerDiff = (b.tours.length + b.events.length) - (a.tours.length + a.events.length);
      if (offerDiff !== 0) return offerDiff;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [events, tours]);

  useEffect(() => {
    const countryNames = countries.map((country) => country.name);

    if (!selectedCountry && countryNames.length > 0) {
      setSelectedCountry(countryNames[0]);
      return;
    }

    if (selectedCountry && countryNames.length > 0 && !countryNames.includes(selectedCountry)) {
      setSelectedCountry(countryNames[0]);
    }
  }, [countries, selectedCountry]);

  useEffect(() => {
    setSelectedCityIds([]);
    setSelectedActivityIds([]);
    setSelectedTourByCity({});
    setTourCustomizationByCity({});
    setDraggedCityId('');
    setProgramDays([]);
    setExpandedProgramDayIds(new Set());
    setProgramCustomized(false);
    setPlanId(null);
  }, [selectedCountry]);

  const countryStats = useMemo(() => {
    return countries.find((country) => country.name === selectedCountry) || null;
  }, [countries, selectedCountry]);

  const heroTour = useMemo(() => {
    return getBestTour(countryStats?.tours?.length ? countryStats.tours : tours);
  }, [countryStats, tours]);

  const heroImage = useMemo(() => {
    if (heroTour) return getTourCardImageSrc(heroTour);
    const eventWithImage = countryStats?.events?.find((event) => getEventImageSrc(event));
    return getEventImageSrc(eventWithImage) || FALLBACK_TOUR_IMAGE;
  }, [countryStats, heroTour]);

  const cities = useMemo(() => {
    const cityMap = new Map();

    const ensureCity = (country, city) => {
      if (!country || !city || country !== selectedCountry) return null;

      const id = getCityId(country, city);
      if (!cityMap.has(id)) {
        cityMap.set(id, {
          id,
          country,
          name: city,
          tours: [],
          events: [],
        });
      }

      return cityMap.get(id);
    };

    tours.forEach((tour) => {
      const city = ensureCity(tour.country, tour.city);
      if (city) city.tours.push(tour);
    });

    events.forEach((event) => {
      const city = ensureCity(event.country, event.city);
      if (city) city.events.push(event);
    });

    return Array.from(cityMap.values())
      .map((city) => ({
        ...city,
        featuredTour: getBestTour(city.tours),
        minPrice: getMinTourPrice(city.tours),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [events, selectedCountry, tours]);

  const cityById = useMemo(() => {
    return new Map(cities.map((city) => [city.id, city]));
  }, [cities]);

  const activities = useMemo(() => {
    const items = [];
    const seen = new Set();

    const addActivity = (activity) => {
      const signature = `${activity.cityId}:${activity.title.toLowerCase()}`;
      if (seen.has(signature)) return;

      seen.add(signature);
      items.push(activity);
    };

    events.forEach((event) => {
      if (!event.country || !event.city || event.country !== selectedCountry) return;

      addActivity({
        id: `event-${event.id}`,
        cityId: getCityId(event.country, event.city),
        city: event.city,
        title: event.title,
        description: event.summary || event.content || 'Подробности мероприятия доступны в карточке события.',
        type: getEventTypeLabel(event.event_type),
        meta: `${formatDate(event.start_date)} · событие города`,
        imageSrc: getEventImageSrc(event),
        source: 'event',
        sourceId: String(event.id),
        startDate: event.start_date || null,
        endDate: event.end_date || null,
      });
    });

    tours.forEach((tour) => {
      if (!tour.country || !tour.city || tour.country !== selectedCountry) return;

      const cityId = getCityId(tour.country, tour.city);
      const tourActivities = [
        ...splitActivities(tour.activities),
        ...splitActivities(tour.activities_features),
      ];
      const tourImages = [
        getTourCardImageSrc(tour),
        ...(Array.isArray(tour.gallery_images)
          ? tour.gallery_images
            .map((image) => getEventImageSrc(image))
            .filter(Boolean)
          : []),
      ];

      tourActivities.forEach((activity, index) => {
        addActivity({
          id: `tour-${tour.id}-activity-${index}`,
          cityId,
          city: tour.city,
          title: activity,
          description: `Часть программы тура «${tour.title}».`,
          type: 'Экскурсия',
          meta: `${tour.duration} дн. · ${formatPrice(tour.price)}`,
          imageSrc: tourImages[index % tourImages.length],
          source: 'tour',
          sourceId: String(tour.id),
          tourId: tour.id,
          tourPrice: Number(tour.price || 0),
          startDate: tour.start_date || null,
          endDate: tour.end_date || null,
        });
      });
    });

    return items.sort((a, b) => {
      const cityCompare = a.city.localeCompare(b.city, 'ru');
      if (cityCompare !== 0) return cityCompare;
      return a.title.localeCompare(b.title, 'ru');
    });
  }, [events, selectedCountry, tours]);

  const activityById = useMemo(() => {
    return new Map(activities.map((activity) => [activity.id, activity]));
  }, [activities]);

  const selectedCitySet = useMemo(() => new Set(selectedCityIds), [selectedCityIds]);
  const selectedActivitySet = useMemo(() => new Set(selectedActivityIds), [selectedActivityIds]);

  const selectedCities = useMemo(() => {
    return selectedCityIds
      .map((cityId) => cityById.get(cityId))
      .filter(Boolean);
  }, [cityById, selectedCityIds]);

  const selectedActivities = useMemo(() => {
    return selectedActivityIds
      .map((id) => activityById.get(id))
      .filter(Boolean);
  }, [activityById, selectedActivityIds]);

  const selectedTours = useMemo(() => {
    return selectedCities.map((city) => {
      const selectedTourId = selectedTourByCity[city.id];
      const selectedTour =
        city.tours.find((tour) => Number(tour.id) === Number(selectedTourId)) ||
        city.featuredTour ||
        city.tours[0] ||
        null;

      return {
        city,
        tour: selectedTour,
        customization: tourCustomizationByCity[city.id] || {
          duration: Number(selectedTour?.duration || 2),
          note: '',
        },
      };
    });
  }, [selectedCities, selectedTourByCity, tourCustomizationByCity]);

  const activitiesByCity = useMemo(() => {
    return selectedCities.map((city) => ({
      city,
      items: activities.filter((activity) => activity.cityId === city.id),
    }));
  }, [activities, selectedCities]);

  const availableCitiesCount = cities.length;
  const availableActivitiesCount = useMemo(() => {
    return activities.filter((activity) => selectedCitySet.has(activity.cityId)).length;
  }, [activities, selectedCitySet]);

  const routePricePerPerson = useMemo(() => {
    return selectedTours.reduce((sum, item) => {
      if (item.tour?.price) {
        const originalDays = Math.max(Number(item.tour.duration || 1), 1);
        const selectedDays = Math.max(
          Number(item.customization?.duration || originalDays),
          1
        );
        return sum + (Number(item.tour.price || 0) * selectedDays / originalDays);
      }
      return sum + Number(item.city.minPrice || 0);
    }, 0);
  }, [selectedTours]);

  const recommendedDays = useMemo(() => {
    if (selectedCities.length === 0) return 0;

    const tourDays = selectedTours.reduce((sum, item) => {
      return sum + Number(item.customization?.duration || item.tour?.duration || 2);
    }, 0);

    return tourDays || selectedCities.length * 2;
  }, [selectedCities, selectedTours]);

  useEffect(() => {
    if (!programCustomized) {
      const suggestedDays = buildSuggestedProgram(selectedTours, selectedActivities, services);
      setProgramDays(suggestedDays);
      setExpandedProgramDayIds((prev) => {
        const next = new Set(suggestedDays.filter((day) => prev.has(day.id)).map((day) => day.id));
        return next;
      });
    }
  }, [programCustomized, selectedActivities, selectedTours, services]);

  const tripDays = programDays.length || recommendedDays;

  const servicesPrice = useMemo(() => {
    if (!selectedCities.length) return 0;

    const people = Number(settings.people || 1);
    const days = Math.max(tripDays, 1);
    const perPerson =
      (MEAL_RATES[services.meal_plan] + HOTEL_RATES[services.hotel_level]) * days
      + TRANSFER_RATES[services.transfer];

    return perPerson * people;
  }, [selectedCities.length, services, settings.people, tripDays]);

  const totalPrice = useMemo(() => {
    return routePricePerPerson * Number(settings.people || 1) + servicesPrice;
  }, [routePricePerPerson, servicesPrice, settings.people]);

  const budgetStatus = useMemo(() => {
    const budget = Number(settings.budget || 0);
    if (!budget || !totalPrice) return null;

    return totalPrice <= budget ? 'fit' : 'over';
  }, [settings.budget, totalPrice]);

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
  };

  const handleSettingChange = (name, value) => {
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePackageSelect = (value) => {
    setPackageType(value);
    const preset = PACKAGE_PRESETS[value];
    if (preset?.services) {
      setServices({ ...preset.services });
    }
  };

  const handleServiceChange = (name, value) => {
    setPackageType('custom');
    setServices((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCityToggle = (city) => {
    const isSelected = selectedCitySet.has(city.id);

    if (isSelected) {
      setSelectedCityIds((prev) => prev.filter((id) => id !== city.id));
      setSelectedActivityIds((prev) =>
        prev.filter((id) => activityById.get(id)?.cityId !== city.id)
      );
      setSelectedTourByCity((prev) => {
        const next = { ...prev };
        delete next[city.id];
        return next;
      });
      setTourCustomizationByCity((prev) => {
        const next = { ...prev };
        delete next[city.id];
        return next;
      });
      return;
    }

    setSelectedCityIds((prev) => [...prev, city.id]);

    if (city.featuredTour) {
      setSelectedTourByCity((prev) => ({
        ...prev,
        [city.id]: city.featuredTour.id,
      }));
      setTourCustomizationByCity((prev) => ({
        ...prev,
        [city.id]: {
          duration: Number(city.featuredTour.duration || 2),
          note: '',
        },
      }));
    }
  };

  const handleTourSelect = (cityId, tourId) => {
    const city = cityById.get(cityId);
    const tour = city?.tours.find((item) => Number(item.id) === Number(tourId));
    setSelectedTourByCity((prev) => ({
      ...prev,
      [cityId]: tourId,
    }));
    setTourCustomizationByCity((prev) => ({
      ...prev,
      [cityId]: {
        duration: Number(tour?.duration || 2),
        note: '',
      },
    }));
    setProgramCustomized(false);
  };

  const handleTourCustomization = (cityId, field, value) => {
    setTourCustomizationByCity((prev) => ({
      ...prev,
      [cityId]: {
        duration: Number(prev[cityId]?.duration || 2),
        note: prev[cityId]?.note || '',
        [field]: field === 'duration' ? Math.min(Math.max(Number(value || 1), 1), 14) : value,
      },
    }));
    if (field === 'duration') {
      setProgramCustomized(false);
    }
  };

  const handleActivityToggle = (activityId) => {
    setSelectedActivityIds((prev) => {
      if (prev.includes(activityId)) {
        return prev.filter((id) => id !== activityId);
      }

      return [...prev, activityId];
    });
  };

  const handleCityActivitiesToggle = (cityActivities) => {
    const ids = cityActivities.map((activity) => activity.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedActivitySet.has(id));

    setSelectedActivityIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      }

      return Array.from(new Set([...prev, ...ids]));
    });
  };

  const moveCity = (cityId, direction) => {
    setSelectedCityIds((prev) => {
      const currentIndex = prev.indexOf(cityId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  };

  const moveCityToTarget = (sourceCityId, targetCityId) => {
    if (!sourceCityId || !targetCityId || sourceCityId === targetCityId) return;

    setSelectedCityIds((prev) => {
      const sourceIndex = prev.indexOf(sourceCityId);
      const targetIndex = prev.indexOf(targetCityId);

      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const next = [...prev];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  const regenerateProgram = () => {
    const suggestedDays = buildSuggestedProgram(selectedTours, selectedActivities, services);
    setProgramDays(suggestedDays);
    setExpandedProgramDayIds(new Set());
    setProgramCustomized(false);
  };

  const updateProgramDay = (id, field, value) => {
    setProgramCustomized(true);
    setProgramDays((prev) =>
      prev.map((day) => (day.id === id ? { ...day, [field]: value } : day))
    );
  };

  const addProgramDay = () => {
    if (!selectedCities.length || programDays.length >= 60) return;

    const dayId = `custom-${Date.now()}`;
    setProgramCustomized(true);
    setProgramDays((prev) => [
      ...prev,
      {
        id: dayId,
        city: selectedCities[0].name,
        title: 'Новый день программы',
        description: '',
        source: 'Добавлено вручную',
      },
    ]);
    setExpandedProgramDayIds((prev) => new Set([...prev, dayId]));
  };

  const removeProgramDay = (id) => {
    setProgramCustomized(true);
    setProgramDays((prev) => prev.filter((day) => day.id !== id));
    setExpandedProgramDayIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const moveProgramDay = (id, direction) => {
    setProgramCustomized(true);
    setProgramDays((prev) => {
      const currentIndex = prev.findIndex((day) => day.id === id);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  };

  const toggleProgramDay = (id) => {
    setExpandedProgramDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAllProgramDaysExpanded = (expanded) => {
    setExpandedProgramDayIds(
      expanded ? new Set(programDays.map((day) => day.id)) : new Set()
    );
  };

  const handleReset = () => {
    setSelectedCityIds([]);
    setSelectedActivityIds([]);
    setSelectedTourByCity({});
    setTourCustomizationByCity({});
    setDraggedCityId('');
    setPackageType('comfort');
    setServices({ ...PACKAGE_PRESETS.comfort.services });
    setProgramDays([]);
    setExpandedProgramDayIds(new Set());
    setProgramCustomized(false);
    setSpecialRequests('');
    setPlanId(null);
  };

  const buildPlanPayload = (status) => ({
    title: `Индивидуальный тур: ${selectedCountry} — ${selectedCities.map((city) => city.name).join(', ')}`,
    country: selectedCountry,
    people_count: Number(settings.people || 1),
    budget: settings.budget ? Number(settings.budget) : null,
    pace: settings.pace,
    interest: settings.interest,
    package_type: packageType,
    services,
    route: selectedTours.map((item, index) => ({
      order: index + 1,
      city: item.city.name,
      tour_id: item.tour?.id || null,
      tour_title: item.tour?.title || null,
      tour_duration: Number(item.customization?.duration || item.tour?.duration || 0),
      tour_price: item.tour?.price ? Number(item.tour.price) : null,
      tour_start_date: item.tour?.start_date || null,
      tour_end_date: item.tour?.end_date || null,
      customization: item.customization?.note?.trim() || null,
    })),
    activities: selectedActivities.map((activity) => ({
      title: activity.title,
      city: activity.city,
      activity_type: activity.type,
      description: activity.description || null,
      source: activity.source || null,
      source_id: activity.sourceId || null,
      start_date: normalizeOptionalDateTime(activity.startDate),
      end_date: normalizeOptionalDateTime(activity.endDate),
    })),
    program: programDays.map((day, index) => ({
      day: index + 1,
      city: day.city,
      title: day.title.trim() || `День ${index + 1}`,
      description: day.description.trim(),
    })),
    special_requests: specialRequests.trim() || null,
    status,
  });

  const handleSave = async (status = 'draft') => {
    if (selectedCities.length === 0) {
      toast.warning('Выберите хотя бы один город для маршрута');
      return;
    }

    if (status === 'submitted' && programDays.length === 0) {
      toast.warning('Сформируйте программу тура перед отправкой');
      return;
    }

    if (!currentUser?.id) {
      toast.warning('Войдите в аккаунт, чтобы сохранить индивидуальный тур');
      navigate('/login', {
        state: {
          from: '/tour-constructor',
        },
      });
      return;
    }

    try {
      setSavingPlan(true);
      const payload = buildPlanPayload(status);
      const response = planId
        ? await tourismAPI.updateTourPlan(planId, payload)
        : await tourismAPI.createTourPlan(payload);
      const savedPlan = response.data;

      setPlanId(savedPlan.id);
      localStorage.setItem(getSavedPlanKey(currentUser.id), JSON.stringify(savedPlan));
      window.dispatchEvent(new Event('notifications-updated'));
      toast.success(
        status === 'submitted'
          ? 'Заявка на индивидуальный тур отправлена менеджеру'
          : 'Черновик индивидуального тура сохранён'
      );
    } catch (err) {
      console.error('Ошибка сохранения индивидуального тура:', err);
      toast.error(normalizeApiError(err, 'Не удалось сохранить индивидуальный тур'));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCheckout = async () => {
    if (selectedCities.length === 0) {
      toast.warning('Выберите хотя бы один город для маршрута');
      return;
    }

    if (programDays.length === 0) {
      toast.warning('Сформируйте программу тура перед оплатой');
      return;
    }

    if (!currentUser?.id) {
      toast.warning('Войдите в аккаунт, чтобы перейти к оплате');
      navigate('/login', { state: { from: '/tour-constructor' } });
      return;
    }

    try {
      setSavingPlan(true);
      const payload = buildPlanPayload('draft');
      const response = planId
        ? await tourismAPI.updateTourPlan(planId, payload)
        : await tourismAPI.createTourPlan(payload);
      const savedPlan = response.data;
      const leadTour = selectedTours.find((item) => item.tour)?.tour;
      const peopleCount = Number(settings.people || 1);
      const estimatedTotal = Number(savedPlan.estimated_total || totalPrice || 0);

      setPlanId(savedPlan.id);
      localStorage.setItem(getSavedPlanKey(currentUser.id), JSON.stringify(savedPlan));

      navigate('/checkout', {
        state: {
          checkoutMode: 'custom-tour',
          peopleCount,
          customPlanId: savedPlan.id,
          customPlanPayload: payload,
          customTotalPrice: estimatedTotal,
          tour: {
            id: `custom-${savedPlan.id}`,
            title: savedPlan.title,
            country: selectedCountry,
            city: selectedCities.map((city) => city.name).join(', '),
            duration: tripDays,
            start_date: leadTour?.start_date || null,
            image_url: leadTour?.image_url || heroTour?.image_url || null,
            price: peopleCount > 0 ? estimatedTotal / peopleCount : estimatedTotal,
            max_people: peopleCount,
            available_seats: peopleCount,
          },
        },
      });
    } catch (err) {
      console.error('Ошибка перехода к оплате индивидуального тура:', err);
      toast.error(normalizeApiError(err, 'Не удалось подготовить индивидуальный тур к оплате'));
    } finally {
      setSavingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell constructor-page">
        <div className="home-empty">Загрузка конструктора туров...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell constructor-page">
        <div className="home-empty constructor-error">
          <strong>{error}</strong>
          <button type="button" className="site-button site-button--primary" onClick={loadConstructorData}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell constructor-page constructor-page--pro">
      <section className="constructor-hero constructor-hero--visual">
        <div className="constructor-hero__content">
          <span className="home-hero__eyebrow">Конструктор туров</span>
          <h1 className="constructor-hero__title">Соберите маршрут под себя</h1>
          <p className="constructor-hero__text">
            Выберите страну, города, базовые туры и мероприятия. Этапы маршрута можно менять местами,
            а расчёт стоимости и длительности обновляется сразу.
          </p>

          <div className="constructor-hero__stats constructor-hero__stats--inline">
            <div>
              <strong>{countries.length}</strong>
              <span>стран доступно</span>
            </div>
            <div>
              <strong>{availableCitiesCount}</strong>
              <span>городов в стране</span>
            </div>
            <div>
              <strong>{selectedActivities.length}</strong>
              <span>мероприятий выбрано</span>
            </div>
          </div>
        </div>

        <div className="constructor-hero__visual">
          <img
            src={heroImage}
            alt={heroTour?.title || 'Направление'}
            onError={(e) => {
              e.currentTarget.src = FALLBACK_TOUR_IMAGE;
            }}
          />

          <div className="constructor-hero__overlay">
            <span>{selectedCountry || 'Направление'}</span>
            <strong>{heroTour?.title || 'Выберите страну для маршрута'}</strong>
            <small>
              {countryStats
                ? `${countryStats.tours.length} туров · ${countryStats.events.length} мероприятий`
                : 'Данные загружаются из карточек туров'}
            </small>
          </div>
        </div>
      </section>

      {countries.length === 0 ? (
        <div className="home-empty">Для конструктора пока нет опубликованных направлений.</div>
      ) : (
        <section className="constructor-layout constructor-layout--pro">
          <div className="constructor-main">
            <section className="constructor-panel constructor-panel--countries">
              <div className="constructor-panel__head">
                <div>
                  <span className="constructor-step">1</span>
                  <h2>Страна и параметры</h2>
                </div>
                <p>Настройте вводные поездки. Они влияют на расчёт бюджета и подсказки маршрута.</p>
              </div>

              <div className="constructor-country-grid constructor-country-grid--visual">
                {countries.map((country) => {
                  const countryTour = getBestTour(country.tours);
                  const countryEvent = country.events.find((event) => getEventImageSrc(event));
                  const countryImage = countryTour
                    ? getTourCardImageSrc(countryTour)
                    : getEventImageSrc(countryEvent) || FALLBACK_TOUR_IMAGE;
                  const isActive = selectedCountry === country.name;

                  return (
                    <button
                      key={country.name}
                      type="button"
                      className={`constructor-country constructor-country--image ${isActive ? 'constructor-country--active' : ''}`}
                      onClick={() => handleCountrySelect(country.name)}
                    >
                      <img
                        src={countryImage}
                        alt={country.name}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                        }}
                      />
                      <span>{country.name}</span>
                      <small>{country.tours.length + country.events.length} предложений</small>
                    </button>
                  );
                })}
              </div>

              <div className="constructor-settings">
                <label className="constructor-setting">
                  <span>Туристы</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.people}
                    onChange={(e) => handleSettingChange('people', e.target.value)}
                  />
                </label>

                <label className="constructor-setting">
                  <span>Бюджет на поездку</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="например, 250000"
                    value={settings.budget}
                    onChange={(e) => handleSettingChange('budget', e.target.value)}
                  />
                </label>

                <label className="constructor-setting">
                  <span>Темп</span>
                  <select
                    value={settings.pace}
                    onChange={(e) => handleSettingChange('pace', e.target.value)}
                  >
                    <option value="relaxed">Спокойный</option>
                    <option value="balanced">Сбалансированный</option>
                    <option value="active">Активный</option>
                  </select>
                </label>

                <label className="constructor-setting">
                  <span>Интерес</span>
                  <select
                    value={settings.interest}
                    onChange={(e) => handleSettingChange('interest', e.target.value)}
                  >
                    <option value="culture">Культура</option>
                    <option value="nature">Природа</option>
                    <option value="family">Семейный отдых</option>
                    <option value="gastro">Гастрономия</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="constructor-panel">
              <div className="constructor-panel__head">
                <div>
                  <span className="constructor-step">2</span>
                  <h2>Города маршрута</h2>
                </div>
                <p>Карточки показывают изображения из туров, сохранённых в системе.</p>
              </div>

              {cities.length === 0 ? (
                <div className="constructor-empty">В выбранной стране пока нет городов.</div>
              ) : (
                <div className="constructor-city-grid constructor-city-grid--visual">
                  {cities.map((city) => {
                    const cityActivities = activities.filter((activity) => activity.cityId === city.id);
                    const cityImage = city.featuredTour
                      ? getTourCardImageSrc(city.featuredTour)
                      : getEventImageSrc(city.events[0]) || FALLBACK_TOUR_IMAGE;

                    return (
                      <button
                        key={city.id}
                        type="button"
                        className={`constructor-city constructor-city--visual ${selectedCitySet.has(city.id) ? 'constructor-city--active' : ''}`}
                        onClick={() => handleCityToggle(city)}
                      >
                        <img
                          src={cityImage}
                          alt={city.name}
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                          }}
                        />
                        <span className="constructor-city__check">
                          {selectedCitySet.has(city.id) ? '✓' : '+'}
                        </span>
                        <div className="constructor-city__body">
                          <strong>{city.name}</strong>
                          <span>{city.tours.length} туров · {cityActivities.length} мероприятий</span>
                          <small>{formatPrice(city.minPrice)}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="constructor-panel">
              <div className="constructor-panel__head">
                <div>
                  <span className="constructor-step">3</span>
                  <h2>Базовые туры</h2>
                </div>
                <p>Для каждого города можно выбрать тур-основу. Его цена и длительность попадут в расчёт.</p>
              </div>

              {selectedCities.length === 0 ? (
                <div className="constructor-empty">Выберите города, чтобы увидеть доступные туры.</div>
              ) : (
                <div className="constructor-tour-groups">
                  {selectedCities.map((city) => (
                    <div key={city.id} className="constructor-tour-group">
                      <div className="constructor-tour-group__head">
                        <strong>{city.name}</strong>
                        <span>{city.tours.length} вариантов</span>
                      </div>

                      {city.tours.length === 0 ? (
                        <div className="constructor-empty constructor-empty--compact">
                          Для города пока нет опубликованных туров.
                        </div>
                      ) : (
                        <div className="constructor-tour-list">
                          {city.tours.map((tour) => {
                            const isSelected = Number(selectedTourByCity[city.id]) === Number(tour.id);
                            const customization = tourCustomizationByCity[city.id] || {
                              duration: Number(tour.duration || 2),
                              note: '',
                            };

                            return (
                              <article
                                key={tour.id}
                                className={`constructor-tour-option-shell ${
                                  isSelected ? 'constructor-tour-option-shell--active' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className={`constructor-tour-option ${isSelected ? 'constructor-tour-option--active' : ''}`}
                                  onClick={() => handleTourSelect(city.id, tour.id)}
                                >
                                  <img
                                    src={getTourCardImageSrc(tour)}
                                    alt={tour.title}
                                    onError={(e) => {
                                      e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                                    }}
                                  />
                                  <span className="constructor-tour-option__state">
                                    {isSelected ? 'Выбран' : 'Выбрать'}
                                  </span>
                                  <div className="constructor-tour-option__content">
                                    <strong>{tour.title}</strong>
                                    <div className="constructor-tour-option__meta">
                                      <span>{formatDateRange(tour.start_date, tour.end_date)}</span>
                                      <span>{tour.available_seats ?? 0} мест</span>
                                    </div>
                                    <small>
                                      {formatMoney(tour.price)} · {tour.duration} дн. · ★ {Number(tour.rating || 0).toFixed(1)}
                                    </small>
                                    <p>
                                      {[tour.meals, tour.accommodation].filter(Boolean).join(' · ')
                                        || 'Проживание и состав услуг указаны в программе'}
                                    </p>
                                  </div>
                                </button>

                                {isSelected && (
                                  <div className="constructor-tour-customization">
                                    <div className="constructor-tour-customization__head">
                                      <strong>Настройка основы</strong>
                                      <span>Стоимость и программа пересчитаются</span>
                                    </div>
                                    <label>
                                      <span>Дней в этом городе</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max="14"
                                        value={customization.duration}
                                        onChange={(e) =>
                                          handleTourCustomization(city.id, 'duration', e.target.value)
                                        }
                                      />
                                    </label>
                                    <label>
                                      <span>Что изменить в туре</span>
                                      <textarea
                                        rows="3"
                                        maxLength="2000"
                                        value={customization.note}
                                        onChange={(e) =>
                                          handleTourCustomization(city.id, 'note', e.target.value)
                                        }
                                        placeholder="Например: больше свободного времени, другой отель, детская программа"
                                      />
                                    </label>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="constructor-panel">
              <div className="constructor-panel__head">
                <div>
                  <span className="constructor-step">4</span>
                  <h2>Мероприятия</h2>
                </div>
                <p>Добавьте события и активности в выбранных городах.</p>
              </div>

              {selectedCities.length === 0 ? (
                <div className="constructor-empty">Сначала выберите один или несколько городов.</div>
              ) : availableActivitiesCount === 0 ? (
                <div className="constructor-empty">Для выбранных городов пока нет мероприятий.</div>
              ) : (
                <div className="constructor-activity-groups">
                  {activitiesByCity.map(({ city, items }) => (
                    <div key={city.id} className="constructor-activity-group">
                      <div className="constructor-activity-group__head">
                        <div>
                          <strong>{city.name}</strong>
                          <span>{items.length} вариантов</span>
                        </div>

                        {items.length > 0 && (
                          <button
                            type="button"
                            className="constructor-mini-button"
                            onClick={() => handleCityActivitiesToggle(items)}
                          >
                            {items.every((item) => selectedActivitySet.has(item.id))
                              ? 'Снять все'
                              : 'Выбрать все'}
                          </button>
                        )}
                      </div>

                      {items.length === 0 ? (
                        <div className="constructor-empty constructor-empty--compact">
                          Нет мероприятий в этом городе.
                        </div>
                      ) : (
                        <div className="constructor-activity-list constructor-activity-list--visual">
                          {items.map((activity) => (
                            <button
                              key={activity.id}
                              type="button"
                              className={`constructor-activity constructor-activity--visual ${
                                selectedActivitySet.has(activity.id) ? 'constructor-activity--active' : ''
                              }`}
                              onClick={() => handleActivityToggle(activity.id)}
                            >
                              <img
                                src={
                                  activity.imageSrc
                                  || getTourCardImageSrc(city.featuredTour)
                                  || getEventImageSrc(city.events[0])
                                  || FALLBACK_TOUR_IMAGE
                                }
                                alt={activity.title}
                                onError={(e) => {
                                  e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                                }}
                              />
                              <span className="constructor-activity__type">{activity.type}</span>
                              <strong>{activity.title}</strong>
                              <p>{activity.description}</p>
                              <small>{activity.meta}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="constructor-panel constructor-program-panel">
              <div className="constructor-panel__head">
                <div>
                  <span className="constructor-step">5</span>
                  <h2>Пакет и программа тура</h2>
                </div>
                <p>
                  Выберите готовый уровень обслуживания или соберите свой пакет, затем
                  отредактируйте программу каждого дня.
                </p>
              </div>

              <div className="constructor-package-grid">
                {Object.entries(PACKAGE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className={`constructor-package ${packageType === key ? 'constructor-package--active' : ''}`}
                    onClick={() => handlePackageSelect(key)}
                    aria-pressed={packageType === key}
                  >
                    <span>{key === 'all_inclusive' ? 'ВК' : key === 'custom' ? 'MY' : key === 'comfort' ? 'C' : 'B'}</span>
                    <strong>{preset.title}</strong>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>

              <div className="constructor-service-config">
                <label className="constructor-setting">
                  <span>Питание</span>
                  <select
                    value={services.meal_plan}
                    onChange={(e) => handleServiceChange('meal_plan', e.target.value)}
                  >
                    <option value="none">Без питания</option>
                    <option value="breakfast">Завтраки</option>
                    <option value="half_board">Завтрак и ужин</option>
                    <option value="full_board">Трёхразовое питание</option>
                    <option value="all_inclusive">Всё включено</option>
                  </select>
                </label>

                <label className="constructor-setting">
                  <span>Размещение</span>
                  <select
                    value={services.hotel_level}
                    onChange={(e) => handleServiceChange('hotel_level', e.target.value)}
                  >
                    <option value="base">Базовое из тура</option>
                    <option value="comfort">Комфорт</option>
                    <option value="premium">Премиум</option>
                  </select>
                </label>

                <label className="constructor-setting">
                  <span>Трансфер</span>
                  <select
                    value={services.transfer}
                    onChange={(e) => handleServiceChange('transfer', e.target.value)}
                  >
                    <option value="none">Не включён</option>
                    <option value="group">Групповой</option>
                    <option value="individual">Индивидуальный</option>
                  </select>
                </label>
              </div>

              <div className="constructor-program-head">
                <div>
                  <strong>Программа по дням</strong>
                  <span>
                    {programDays.length} дней · откройте только тот день, который хотите изменить
                  </span>
                </div>
                <div className="constructor-program-head__actions">
                  {programDays.length > 0 && (
                    <button
                      type="button"
                      className="constructor-program-view-button"
                      onClick={() => setAllProgramDaysExpanded(
                        expandedProgramDayIds.size !== programDays.length
                      )}
                    >
                      {expandedProgramDayIds.size === programDays.length
                        ? 'Свернуть всё'
                        : 'Развернуть всё'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="site-button site-button--secondary"
                    onClick={regenerateProgram}
                    disabled={selectedCities.length === 0}
                    title="Пересобрать программу из выбранных туров, мероприятий и услуг"
                  >
                    Автопрограмма
                  </button>
                  <button
                    type="button"
                    className="site-button site-button--primary"
                    onClick={addProgramDay}
                    disabled={selectedCities.length === 0 || programDays.length >= 60}
                  >
                    Добавить день
                  </button>
                </div>
              </div>

              {selectedCities.length === 0 ? (
                <div className="constructor-empty">
                  Выберите города и базовые туры, чтобы сформировать программу.
                </div>
              ) : programDays.length === 0 ? (
                <div className="constructor-empty">
                  Добавьте первый день вручную или соберите программу автоматически.
                </div>
              ) : (
                <div className="constructor-program-list">
                  {programDays.map((day, index) => {
                    const isExpanded = expandedProgramDayIds.has(day.id);

                    return (
                      <article
                        key={day.id}
                        className={`constructor-program-day ${
                          isExpanded ? 'constructor-program-day--expanded' : ''
                        }`}
                      >
                        <div className="constructor-program-day__number">
                          <span>День</span>
                          <strong>{index + 1}</strong>
                        </div>

                        <div className="constructor-program-day__summary">
                          <div className="constructor-program-day__meta">
                            <span>{day.city}</span>
                            <small>{day.source || 'Индивидуальная программа'}</small>
                          </div>
                          <button
                            type="button"
                            className="constructor-program-day__toggle"
                            onClick={() => toggleProgramDay(day.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`program-day-${day.id}`}
                          >
                            <span>
                              <strong>{day.title || `День ${index + 1}`}</strong>
                              <small>
                                {day.description || 'Описание пока не заполнено'}
                              </small>
                            </span>
                            <span className="constructor-program-day__toggle-label">
                              {isExpanded ? 'Готово' : 'Редактировать'}
                            </span>
                          </button>
                        </div>

                        <div className="constructor-program-day__controls">
                          <button
                            type="button"
                            onClick={() => moveProgramDay(day.id, -1)}
                            disabled={index === 0}
                            aria-label={`Поднять день ${index + 1}`}
                            title="Переместить выше"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveProgramDay(day.id, 1)}
                            disabled={index === programDays.length - 1}
                            aria-label={`Опустить день ${index + 1}`}
                            title="Переместить ниже"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="constructor-program-day__remove"
                            onClick={() => removeProgramDay(day.id)}
                            aria-label={`Удалить день ${index + 1}`}
                            title="Удалить день"
                          >
                            ×
                          </button>
                        </div>

                        {isExpanded && (
                          <div
                            id={`program-day-${day.id}`}
                            className="constructor-program-day__fields"
                          >
                            <label>
                              <span>Город</span>
                              <select
                                value={day.city}
                                onChange={(e) => updateProgramDay(day.id, 'city', e.target.value)}
                              >
                                {selectedCities.map((city) => (
                                  <option key={city.id} value={city.name}>{city.name}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Название дня</span>
                              <input
                                type="text"
                                value={day.title}
                                maxLength="255"
                                onChange={(e) => updateProgramDay(day.id, 'title', e.target.value)}
                              />
                            </label>
                            <label className="constructor-program-day__description">
                              <span>
                                Описание
                                <small>{day.description.length}/3000</small>
                              </span>
                              <textarea
                                rows={Math.min(10, Math.max(4, Math.ceil(day.description.length / 90)))}
                                value={day.description}
                                maxLength="3000"
                                onChange={(e) => updateProgramDay(day.id, 'description', e.target.value)}
                                placeholder="Опишите трансфер, экскурсии, свободное время и питание"
                              />
                            </label>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              <label className="constructor-special-requests">
                <span>Особые пожелания</span>
                <textarea
                  rows="4"
                  maxLength="5000"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Детское меню, раздельные кровати, доступная среда, ранний заезд..."
                />
              </label>
            </section>
          </div>

          <aside className="constructor-summary constructor-summary--pro">
            <div className="constructor-summary__head">
              <span className="home-hero__eyebrow">Ваш маршрут</span>
              <h2>{selectedCountry || 'Страна не выбрана'}</h2>
            </div>

            <div className="constructor-summary__metrics">
              <div>
                <span>Города</span>
                <strong>{selectedCities.length}</strong>
              </div>
              <div>
                <span>Мероприятия</span>
                <strong>{selectedActivities.length}</strong>
              </div>
              <div>
                <span>Дни</span>
                <strong>{tripDays || '—'}</strong>
              </div>
            </div>

            <div className="constructor-summary__price">
              <span>Расчёт на {settings.people || 1} чел.</span>
              <strong>{formatMoney(totalPrice)}</strong>
              <div className="constructor-summary__breakdown">
                <span>Базовые туры</span>
                <b>{formatMoney(routePricePerPerson * Number(settings.people || 1))}</b>
                <span>Пакет услуг</span>
                <b>{formatMoney(servicesPrice)}</b>
              </div>
              {budgetStatus && (
                <small className={`constructor-budget constructor-budget--${budgetStatus}`}>
                  {budgetStatus === 'fit' ? 'в пределах бюджета' : 'выше бюджета'}
                </small>
              )}
            </div>

            <div className="constructor-summary__prefs">
              <span>{PACE_LABELS[settings.pace]}</span>
              <span>{INTEREST_LABELS[settings.interest]}</span>
              <span>{PACKAGE_LABELS[packageType]}</span>
            </div>

            {selectedCities.length === 0 ? (
              <div className="constructor-summary__empty">
                Выберите города, и здесь появится план поездки.
              </div>
            ) : (
              <div className="constructor-timeline constructor-timeline--draggable">
                {selectedTours.map((item, index) => {
                  const cityActivities = selectedActivities.filter((activity) => activity.cityId === item.city.id);
                  const imageSrc = item.tour
                    ? getTourCardImageSrc(item.tour)
                    : getTourCardImageSrc(item.city.featuredTour);

                  return (
                    <div
                      key={item.city.id}
                      className={`constructor-timeline__item constructor-timeline__item--rich ${
                        draggedCityId === item.city.id ? 'constructor-timeline__item--dragging' : ''
                      }`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedCityId(item.city.id);
                        e.dataTransfer.setData('text/plain', item.city.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceCityId = e.dataTransfer.getData('text/plain') || draggedCityId;
                        moveCityToTarget(sourceCityId, item.city.id);
                        setDraggedCityId('');
                      }}
                      onDragEnd={() => setDraggedCityId('')}
                    >
                      <img
                        src={imageSrc || FALLBACK_TOUR_IMAGE}
                        alt={item.city.name}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_TOUR_IMAGE;
                        }}
                      />

                      <div className="constructor-timeline__content">
                        <span>Этап {index + 1}</span>
                        <strong>{item.city.name}</strong>
                        <p>{item.tour?.title || 'Тур не выбран'}</p>
                        {cityActivities.length > 0 && (
                          <small>{cityActivities.map((activity) => activity.title).join(', ')}</small>
                        )}
                      </div>

                      <div className="constructor-timeline__controls">
                        <button
                          type="button"
                          onClick={() => moveCity(item.city.id, -1)}
                          disabled={index === 0}
                          aria-label={`Поднять ${item.city.name} выше`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCity(item.city.id, 1)}
                          disabled={index === selectedTours.length - 1}
                          aria-label={`Опустить ${item.city.name} ниже`}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="constructor-summary__actions">
              {planId && (
                <span className="constructor-plan-saved">План #{planId} сохранён в системе</span>
              )}
              <button
                type="button"
                className="site-button site-button--primary"
                onClick={handleCheckout}
                disabled={savingPlan || selectedCities.length === 0 || programDays.length === 0}
              >
                {savingPlan ? 'Переход к оплате...' : 'Оплатить'}
              </button>
              <button
                type="button"
                className="site-button site-button--secondary"
                onClick={() => handleSave('draft')}
                disabled={savingPlan || selectedCities.length === 0}
              >
                Сохранить черновик
              </button>
              <Link to="/tours" className="site-button site-button--secondary">
                Смотреть туры
              </Link>
              <button type="button" className="constructor-reset" onClick={handleReset}>
                Начать заново
              </button>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
};

export default TourConstructor;
