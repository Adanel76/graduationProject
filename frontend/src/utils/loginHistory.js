import Cookies from 'js-cookie';

const LOGIN_HISTORY_COOKIE = 'login_history';
const MAX_HISTORY_ITEMS = 10; // Максимум 10 записей

// Добавить запись в историю входов
export const addLoginHistory = (userData) => {
  try {
    const currentTime = new Date().toISOString();
    const loginRecord = {
      email: userData.email,
      name: `${userData.first_name} ${userData.last_name}`,
      timestamp: currentTime,
      userAgent: navigator.userAgent,
      ip: '' // В реальном приложении здесь будет IP адрес
    };

    // Получаем текущую историю
    const history = getLoginHistory();
    
    // Добавляем новую запись в начало
    const newHistory = [loginRecord, ...history.slice(0, MAX_HISTORY_ITEMS - 1)];
    
    // Сохраняем в cookies (на 30 дней)
    Cookies.set(LOGIN_HISTORY_COOKIE, JSON.stringify(newHistory), { 
      expires: 30,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return newHistory;
  } catch (error) {
    console.error('Ошибка при добавлении в историю входов:', error);
    return [];
  }
};

// Получить историю входов
export const getLoginHistory = () => {
  try {
    const history = Cookies.get(LOGIN_HISTORY_COOKIE);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Ошибка при получении истории входов:', error);
    return [];
  }
};

// Очистить историю входов
export const clearLoginHistory = () => {
  try {
    Cookies.remove(LOGIN_HISTORY_COOKIE);
  } catch (error) {
    console.error('Ошибка при очистке истории входов:', error);
  }
};

// Форматировать дату для отображения
export const formatLoginDate = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return 'Сегодня';
  } else if (diffDays === 2) {
    return 'Вчера';
  } else if (diffDays <= 7) {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return days[date.getDay()];
  } else {
    return date.toLocaleDateString('ru-RU');
  }
};

// Получить относительное время
export const getRelativeTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  
  if (diffSeconds < 60) {
    return 'только что';
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} ${getPlural(minutes, 'минуту', 'минуты', 'минут')} назад`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} ${getPlural(hours, 'час', 'часа', 'часов')} назад`;
  } else {
    const days = Math.floor(diffSeconds / 86400);
    return `${days} ${getPlural(days, 'день', 'дня', 'дней')} назад`;
  }
};

// Вспомогательная функция для склонения
const getPlural = (count, one, few, many) => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return many;
  }
  
  switch (lastDigit) {
    case 1: return one;
    case 2:
    case 3:
    case 4: return few;
    default: return many;
  }
};
