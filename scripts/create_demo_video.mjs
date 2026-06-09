import { spawn } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = resolve(import.meta.dirname, '..');
const WORK_DIR = join(ROOT, '.demo-video-work');
const FRAME_DIR = join(WORK_DIR, 'frames');
const PROFILE_DIR = join(ROOT, '.chrome-video-recording');
const ARTIFACT_DIR = join(ROOT, 'artifacts');
const MANIFEST_PATH = join(ARTIFACT_DIR, 'travel_agency_demo_manifest.json');
const NARRATION_PATH = join(ARTIFACT_DIR, 'travel_agency_demo_narration_ru.md');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000';
const DEBUG_PORT = 9334;
const RENDER_PORT = 4177;
const VIEWPORT = { width: 1440, height: 810 };

const assertWorkspacePath = (target) => {
  const resolved = resolve(target);
  if (!resolved.toLowerCase().startsWith(ROOT.toLowerCase())) {
    throw new Error(`Unsafe workspace path: ${resolved}`);
  }
  return resolved;
};

const resetDirectory = (target) => {
  const safeTarget = assertWorkspacePath(target);
  if (existsSync(safeTarget)) rmSync(safeTarget, { recursive: true, force: true });
  mkdirSync(safeTarget, { recursive: true });
};

if (!existsSync(CHROME_PATH)) {
  throw new Error(`Chrome not found: ${CHROME_PATH}`);
}

resetDirectory(WORK_DIR);
mkdirSync(FRAME_DIR, { recursive: true });
mkdirSync(ARTIFACT_DIR, { recursive: true });

const api = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${method} ${path}: ${response.status} ${details}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const login = async (email) => {
  const auth = await api('/users/login', {
    method: 'POST',
    body: { email, password: 'demo12345' },
  });
  const user = await api('/users/me', { token: auth.access_token });
  return { token: auth.access_token, user };
};

const client = await login('client01@demo.travel');
const manager = await login('manager.demo@demo.travel');
const analyst = await login('analyst.demo@demo.travel');
const tours = await api('/tours/');
const featuredTour = tours.find((tour) => tour.image_url || tour.image_data) || tours[0];

if (!featuredTour) {
  throw new Error('The catalog has no tours for the demonstration.');
}

const demoPlanPayload = {
  title: 'Индивидуальный тур: Россия — Москва и Санкт-Петербург',
  country: 'Россия',
  people_count: 2,
  budget: 280000,
  pace: 'balanced',
  interest: 'culture',
  package_type: 'comfort',
  services: {
    meal_plan: 'breakfast',
    hotel_level: 'comfort',
    transfer: 'group',
    insurance: true,
    guide: true,
    excursions: true,
    priority_support: false,
  },
  route: [
    {
      order: 1,
      city: 'Москва',
      tour_id: null,
      tour_title: 'Культурные выходные в Москве',
      tour_duration: 2,
      tour_price: 52000,
      customization: 'Больше времени в музеях и вечерняя прогулка по центру.',
    },
    {
      order: 2,
      city: 'Санкт-Петербург',
      tour_id: null,
      tour_title: 'Белые ночи и дворцы',
      tour_duration: 2,
      tour_price: 64000,
      customization: 'Посещение Эрмитажа и прогулка по Неве.',
    },
  ],
  activities: [
    {
      title: 'Экскурсия по Московскому Кремлю',
      city: 'Москва',
      activity_type: 'Экскурсия',
      description: 'Исторический центр столицы с профессиональным гидом.',
      source: 'demo-video',
      source_id: 'kremlin',
    },
    {
      title: 'Вечерняя прогулка по Неве',
      city: 'Санкт-Петербург',
      activity_type: 'Прогулка',
      description: 'Разводные мосты и панорама города с воды.',
      source: 'demo-video',
      source_id: 'neva',
    },
  ],
  program: [
    {
      day: 1,
      city: 'Москва',
      title: 'Прибытие и знакомство со столицей',
      description: 'Трансфер, размещение, Красная площадь и вечерняя прогулка.',
    },
    {
      day: 2,
      city: 'Москва',
      title: 'Кремль и исторический центр',
      description: 'Экскурсия, музеи и свободное время.',
    },
    {
      day: 3,
      city: 'Санкт-Петербург',
      title: 'Переезд и дворцовая архитектура',
      description: 'Размещение, Невский проспект и основные достопримечательности.',
    },
    {
      day: 4,
      city: 'Санкт-Петербург',
      title: 'Эрмитаж и прогулка по Неве',
      description: 'Музейная программа и вечерняя водная экскурсия.',
    },
  ],
  special_requests: 'Тихие номера, раздельные кровати и трансфер от вокзала.',
  status: 'draft',
};

let demoPlan = null;
let chromeProcess = null;
let cdp = null;

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.opened = new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', rejectOpen, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve: resolveCall, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveCall(message.result || {});
    });
  }

  async send(method, params = {}) {
    await this.opened;
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      this.pending.set(id, { resolve: resolveCall, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const waitForDebugTarget = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error('Chrome DevTools target did not start.');
};

const launchChrome = async () => {
  try {
    const target = await waitForDebugTarget();
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    console.log('Connected to the prepared Chrome process.');
    return;
  } catch {
    // Fall back to a direct launch when the environment permits it.
  }

  chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );

  const target = await waitForDebugTarget();
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
};

const evaluate = async (expression, awaitPromise = false) => {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  }
  return result.result?.value;
};

const goto = async (url, waitMs = 1800) => {
  await cdp.send('Page.navigate', { url });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate('document.readyState');
    if (ready === 'complete') break;
    await delay(100);
  }
  await delay(waitMs);
};

const waitForSelector = async (selector, timeoutMs = 12000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await delay(180);
  }
  throw new Error(`Selector did not appear: ${selector}`);
};

const setAuth = async ({ token, user }) => {
  await goto(APP_URL, 400);
  await evaluate(`
    localStorage.setItem('token', ${JSON.stringify(token)});
    localStorage.setItem('userRole', ${JSON.stringify(user.role)});
    localStorage.setItem('currentUserCache', ${JSON.stringify(JSON.stringify(user))});
    true;
  `);
};

const clearAuth = async () => {
  await goto(APP_URL, 300);
  await evaluate(`
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUserCache');
    true;
  `);
};

const clickFirst = async (selector) => {
  const clicked = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      element.click();
      return true;
    })()
  `);
  if (!clicked) throw new Error(`Cannot click selector: ${selector}`);
  await delay(900);
};

const clickByText = async (selector, text, exact = false) => {
  const clicked = await evaluate(`
    (() => {
      const wanted = ${JSON.stringify(text)}.trim().toLowerCase();
      const element = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
        .find((node) => {
          const value = (node.textContent || '').trim().toLowerCase();
          return ${exact ? 'value === wanted' : 'value.includes(wanted)'};
        });
      if (!element) return false;
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      element.click();
      return true;
    })()
  `);
  if (!clicked) throw new Error(`Cannot click text "${text}" in ${selector}`);
  await delay(900);
};

const scrollTo = async (selector, offset = -130) => {
  const found = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.scrollIntoView({ block: 'start', behavior: 'instant' });
      window.scrollBy(0, ${Number(offset)});
      return true;
    })()
  `);
  if (!found) throw new Error(`Cannot scroll to selector: ${selector}`);
  await delay(700);
};

const scrollPage = async (top) => {
  await evaluate(`window.scrollTo({ top: ${Number(top)}, behavior: 'instant' }); true;`);
  await delay(700);
};

const addCaption = async (chapter, title, note = '') => {
  await evaluate(`
    (() => {
      document.querySelector('#demo-caption')?.remove();
      const caption = document.createElement('div');
      caption.id = 'demo-caption';
      caption.innerHTML = \`
        <span>${chapter}</span>
        <strong>${title}</strong>
        ${note ? `<small>${note}</small>` : ''}
      \`;
      Object.assign(caption.style, {
        position: 'fixed',
        left: '28px',
        bottom: '24px',
        zIndex: '2147483647',
        width: 'min(520px, calc(100vw - 56px))',
        padding: '16px 20px',
        borderRadius: '14px',
        color: '#fff',
        background: 'rgba(8, 19, 44, 0.92)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 18px 52px rgba(0,0,0,0.28)',
        backdropFilter: 'blur(14px)',
        fontFamily: 'Arial, sans-serif',
        pointerEvents: 'none'
      });
      const span = caption.querySelector('span');
      Object.assign(span.style, {
        display: 'block',
        marginBottom: '5px',
        color: '#7da7ff',
        fontSize: '11px',
        fontWeight: '900',
        letterSpacing: '1.4px',
        textTransform: 'uppercase'
      });
      const strong = caption.querySelector('strong');
      Object.assign(strong.style, {
        display: 'block',
        fontSize: '22px',
        lineHeight: '1.15',
        letterSpacing: '0'
      });
      const small = caption.querySelector('small');
      if (small) Object.assign(small.style, {
        display: 'block',
        marginTop: '7px',
        color: 'rgba(255,255,255,0.76)',
        fontSize: '13px',
        lineHeight: '1.45'
      });
      document.body.appendChild(caption);
      return true;
    })()
  `);
};

const highlight = async (selector) => {
  await evaluate(`
    (() => {
      document.querySelectorAll('[data-demo-highlight]').forEach((node) => {
        node.style.removeProperty('outline');
        node.style.removeProperty('outline-offset');
        node.removeAttribute('data-demo-highlight');
      });
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.dataset.demoHighlight = 'true';
      element.style.outline = '4px solid #2563eb';
      element.style.outlineOffset = '5px';
      return true;
    })()
  `);
};

const setTitlePage = async (eyebrow, title, subtitle) => {
  const html = `<!doctype html>
  <html lang="ru">
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; }
        body {
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #fff;
          background:
            linear-gradient(112deg, rgba(6, 14, 32, .94), rgba(24, 67, 169, .82)),
            url('${featuredTour.image_url || ''}') center/cover;
          font-family: Arial, sans-serif;
        }
        main { width: min(1040px, calc(100% - 100px)); }
        span {
          display: inline-block;
          padding: 9px 13px;
          border-radius: 999px;
          color: #dbeafe;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        h1 {
          max-width: 1000px;
          margin: 22px 0 20px;
          font-size: 74px;
          line-height: .94;
          letter-spacing: 0;
        }
        p {
          max-width: 820px;
          margin: 0;
          color: rgba(255,255,255,.78);
          font-size: 24px;
          line-height: 1.5;
        }
        footer {
          position: fixed;
          right: 44px;
          bottom: 34px;
          color: rgba(255,255,255,.58);
          font-size: 14px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <main>
        <span>${eyebrow}</span>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </main>
      <footer>Travel Agency · дипломный проект</footer>
    </body>
  </html>`;
  await goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, 900);
};

const frames = [];
let frameCounter = 0;

const capture = async ({
  chapter,
  title,
  note = '',
  duration = 7,
  caption = true,
  narration = '',
}) => {
  if (caption) await addCaption(chapter, title, note);
  const image = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 84,
    fromSurface: true,
    captureBeyondViewport: false,
  });
  frameCounter += 1;
  const file = `${String(frameCounter).padStart(3, '0')}.jpg`;
  writeFileSync(join(FRAME_DIR, file), Buffer.from(image.data, 'base64'));
  frames.push({ file, chapter, title, note, duration, narration });
  console.log(`[${frameCounter}] ${chapter}: ${title}`);
};

const safeScene = async (label, action) => {
  try {
    await action();
  } catch (error) {
    console.warn(`Scene skipped (${label}): ${error.message}`);
  }
};

const buildScreens = async () => {
  await setTitlePage(
    'Демонстрация рабочей системы',
    'Travel Agency',
    'Каталог туров, индивидуальное планирование, бронирование, управление данными и локальный MetricBot.',
  );
  await capture({
    chapter: 'Введение',
    title: 'Travel Agency',
    duration: 7,
    caption: false,
    narration: 'Перед вами информационно-аналитическая система туристического агентства Travel Agency. В демонстрации показан полный путь клиента и работа сотрудников.',
  });

  await clearAuth();
  await goto(`${APP_URL}/`);
  await capture({
    chapter: 'Публичная часть',
    title: 'Главная страница',
    note: 'Основные направления и быстрый переход к сервисам.',
    duration: 7,
    narration: 'Главная страница знакомит пользователя с платформой, популярными направлениями и основными возможностями системы.',
  });

  await scrollPage(720);
  await capture({
    chapter: 'Публичная часть',
    title: 'Подбор направлений',
    note: 'Карточки ведут к реальным турам и используют изображения из базы данных.',
    duration: 6,
    narration: 'Ниже расположены подборки направлений и реальные изображения, связанные с туристическими объектами в базе данных.',
  });

  await goto(`${APP_URL}/tours`, 2200);
  await waitForSelector('.tour-card');
  await capture({
    chapter: 'Каталог',
    title: 'Поиск и фильтрация туров',
    note: 'Страна, цена, даты, длительность и сортировка.',
    duration: 8,
    narration: 'Каталог поддерживает поиск, фильтрацию по стране, стоимости, датам и длительности, а также сортировку результатов.',
  });

  await scrollPage(430);
  await capture({
    chapter: 'Каталог',
    title: 'Информативные карточки',
    note: 'Цена, рейтинг, длительность, свободные места и избранное.',
    duration: 7,
    narration: 'Карточка сразу показывает цену, длительность, рейтинг и количество свободных мест. Тур можно добавить в избранное.',
  });

  await goto(`${APP_URL}/tours/${featuredTour.id}`, 2400);
  await capture({
    chapter: 'Карточка тура',
    title: featuredTour.title,
    note: 'Фотогалерея, стоимость, даты и оформление заявки.',
    duration: 8,
    narration: 'На отдельной странице представлены основные характеристики тура, фотогалерея, даты, стоимость и действие для оформления.',
  });

  await scrollPage(850);
  await capture({
    chapter: 'Карточка тура',
    title: 'Программа, отель и условия',
    note: 'Пользователь получает всю информацию до бронирования.',
    duration: 8,
    narration: 'Подробные блоки описывают программу по дням, размещение, питание, активности и особенности курорта.',
  });

  await goto(`${APP_URL}/events`, 2200);
  await capture({
    chapter: 'Мероприятия',
    title: 'Новости, акции и события',
    note: 'Опубликованные материалы управляются из административной панели.',
    duration: 7,
    narration: 'Раздел мероприятий содержит новости, акции, вебинары и туристические события, которые публикуются сотрудниками.',
  });

  await goto(`${APP_URL}/login`);
  await evaluate(`
    (() => {
      const email = document.querySelector('input[name="email"]');
      const password = document.querySelector('input[name="password"]');
      const setValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue(email, 'client01@demo.travel');
      setValue(password, 'demo12345');
      return true;
    })()
  `);
  await capture({
    chapter: 'Авторизация',
    title: 'Вход в личный кабинет',
    note: 'Роли клиента, менеджера и аналитика разделены на уровне маршрутов и API.',
    duration: 7,
    narration: 'После авторизации пользователь получает доступ к личным данным, избранному, уведомлениям, оплате и своим заявкам.',
  });

  await setAuth(client);
  await goto(`${APP_URL}/profile`, 1800);
  await capture({
    chapter: 'Личный кабинет',
    title: 'Профиль пользователя',
    note: 'Контактные данные, телефон, настройки и быстрые действия.',
    duration: 7,
    narration: 'В профиле хранятся контактные данные пользователя, включая телефон, который затем доступен менеджеру в информации о бронировании.',
  });

  await goto(`${APP_URL}/my-bookings`, 2200);
  await capture({
    chapter: 'Личный кабинет',
    title: 'Бронирования и индивидуальные планы',
    note: 'Статусы заявок, оплаты и сохранённые маршруты.',
    duration: 8,
    narration: 'Страница моих бронирований объединяет обычные заявки и индивидуальные планы, отображая стоимость и текущий статус.',
  });

  await safeScene('open client plan', async () => {
    await clickFirst('.custom-plan-card--interactive');
    await waitForSelector('.user-tour-plan-drawer');
    await capture({
      chapter: 'Индивидуальный план',
      title: 'Полная карточка маршрута',
      note: 'Параметры, услуги, мероприятия, программа по дням и пожелания.',
      duration: 10,
      narration: 'Пользователь может открыть свой план и увидеть маршрут, выбранный пакет услуг, мероприятия, программу каждого дня и особые пожелания.',
    });
    await clickByText('.user-tour-plan-drawer button', 'Закрыть');
  });

  await goto(`${APP_URL}/tour-constructor`, 2600);
  await waitForSelector('.constructor-country');
  await capture({
    chapter: 'Конструктор туров',
    title: 'Страна и параметры поездки',
    note: 'Количество туристов, бюджет, темп и основной интерес.',
    duration: 8,
    narration: 'Конструктор начинается с выбора страны и параметров поездки: количества туристов, бюджета, темпа и интересов.',
  });

  await safeScene('constructor country and city', async () => {
    await clickByText('.constructor-country', 'Россия');
    await waitForSelector('.constructor-city');
    await scrollTo('.constructor-city', -160);
    await capture({
      chapter: 'Конструктор туров',
      title: 'Города маршрута',
      note: 'Для каждой страны загружается собственный набор городов.',
      duration: 8,
      narration: 'После выбора страны система показывает доступные города с собственными изображениями, турами и мероприятиями.',
    });
    await clickFirst('.constructor-city');
  });

  await safeScene('constructor base tour', async () => {
    await waitForSelector('.constructor-tour-option-shell');
    await scrollTo('.constructor-tour-option-shell', -180);
    await capture({
      chapter: 'Конструктор туров',
      title: 'Базовые туры',
      note: 'Основа определяет длительность и базовую стоимость этапа.',
      duration: 8,
      narration: 'Для выбранного города можно назначить базовый тур и вручную изменить количество дней или добавить пожелания.',
    });
    await clickFirst('.constructor-tour-option');
  });

  await safeScene('constructor events', async () => {
    await waitForSelector('.constructor-activity');
    await scrollTo('.constructor-activity', -160);
    await capture({
      chapter: 'Конструктор туров',
      title: 'Выбор мероприятий',
      note: 'Каждая активность связана с конкретным городом.',
      duration: 8,
      narration: 'Далее пользователь добавляет экскурсии и активности. Их количество и содержание сразу отражаются в расчёте и программе.',
    });
    await clickFirst('.constructor-activity');
  });

  await safeScene('constructor package', async () => {
    await waitForSelector('.constructor-package');
    await scrollTo('.constructor-package', -160);
    await clickByText('.constructor-package', 'Всё включено');
    await capture({
      chapter: 'Конструктор туров',
      title: 'Пакет обслуживания',
      note: 'Базовый, комфорт, всё включено или собственный набор услуг.',
      duration: 8,
      narration: 'Доступны готовые уровни обслуживания и собственный пакет с настройкой питания, размещения, трансфера, страховки и сопровождения.',
    });
  });

  await safeScene('constructor program', async () => {
    await clickByText('button', 'Собрать автоматически');
    await delay(1000);
    await scrollTo('.constructor-program-day', -170);
    await capture({
      chapter: 'Конструктор туров',
      title: 'Программа по дням',
      note: 'Порядок, город, заголовок и описание каждого дня можно изменить.',
      duration: 10,
      narration: 'Система автоматически формирует программу по дням. Пользователь может менять порядок, содержание, город и добавлять собственные пожелания.',
    });
  });

  await safeScene('constructor summary', async () => {
    await scrollPage(0);
    await highlight('.constructor-summary');
    await capture({
      chapter: 'Конструктор туров',
      title: 'Расчёт в реальном времени',
      note: 'Маршрут, длительность, услуги и итоговая стоимость.',
      duration: 8,
      narration: 'Справа постоянно отображается состав маршрута и актуальная предварительная стоимость. Кнопка оплаты переводит к оформлению.',
    });
  });

  const checkoutTour = {
    id: featuredTour.id,
    title: demoPlan.title,
    price: demoPlan.estimated_total,
    country: demoPlan.country,
    city: 'Москва и Санкт-Петербург',
    duration: demoPlan.program.length,
    image_url: featuredTour.image_url,
    max_people: 20,
    available_seats: 20,
  };
  const checkoutState = {
    tour: checkoutTour,
    peopleCount: demoPlan.people_count,
    checkoutMode: 'custom-tour',
    customPlanId: demoPlan.id,
    customPlanPayload: demoPlanPayload,
    customTotalPrice: demoPlan.estimated_total,
  };
  await goto(APP_URL, 400);
  await evaluate(`
    history.replaceState(
      { usr: ${JSON.stringify(checkoutState)}, key: 'demo-video' },
      '',
      '/checkout'
    );
    location.reload();
  `);
  await delay(2300);
  await capture({
    chapter: 'Оформление',
    title: 'Контактные данные',
    note: 'Данные профиля подставляются автоматически.',
    duration: 8,
    narration: 'На первом шаге оплаты контактные данные подставляются из профиля, а пользователь может добавить адрес и комментарий.',
  });

  await safeScene('checkout confirmation', async () => {
    await clickByText('button', 'Продолжить', true);
    await capture({
      chapter: 'Оформление',
      title: 'Подтверждение заказа',
      note: 'Состав тура, стоимость, скидка и способ оплаты.',
      duration: 9,
      narration: 'На втором шаге проверяется состав заказа, итоговая сумма и способ оплаты. После подтверждения заявка становится доступна менеджеру.',
    });
  });

  await setAuth(manager);
  await goto(`${APP_URL}/admin`, 2400);
  await capture({
    chapter: 'Панель сотрудника',
    title: 'Центр управления',
    note: 'Оперативные показатели и быстрые переходы по рабочим разделам.',
    duration: 9,
    narration: 'Панель сотрудника показывает пользователей онлайн, количество туров, заявок и ключевые рабочие разделы.',
  });

  await goto(`${APP_URL}/admin/bookings`, 2600);
  await capture({
    chapter: 'Администрирование',
    title: 'Управление бронированиями',
    note: 'Фильтры, статусы заявки, оплаты и индивидуальные туры.',
    duration: 8,
    narration: 'Менеджер фильтрует бронирования, контролирует статусы заявки и оплаты, а также видит запросы на индивидуальные туры.',
  });

  await safeScene('booking detail', async () => {
    await clickByText('button', 'Открыть', true);
    await waitForSelector('.admin-bookings-drawer');
    await capture({
      chapter: 'Администрирование',
      title: 'Карточка бронирования',
      note: 'Клиент, телефон, тур, стоимость, дата и изменение статуса.',
      duration: 9,
      narration: 'В карточке заявки доступны контакты клиента, включая номер телефона, параметры тура, стоимость и инструменты изменения статуса.',
    });
    await clickByText('.admin-bookings-drawer button', 'Закрыть');
  });

  await safeScene('admin custom plan', async () => {
    await clickByText('button', 'Открыть заявку');
    await waitForSelector('.admin-tour-plan-drawer');
    await capture({
      chapter: 'Администрирование',
      title: 'Индивидуальный тур менеджера',
      note: 'Вся информация, введённая пользователем в конструкторе.',
      duration: 10,
      narration: 'Индивидуальный план открывается так же подробно, как обычная заявка: менеджеру видны маршрут, услуги, мероприятия, программа и пожелания.',
    });
    await clickByText('.admin-tour-plan-drawer button', 'Закрыть');
  });

  await goto(`${APP_URL}/admin/tours`, 2500);
  await capture({
    chapter: 'Администрирование',
    title: 'Каталог туров',
    note: 'Создание, редактирование, изображения, CSV-импорт и экспорт.',
    duration: 9,
    narration: 'В административном каталоге сотрудники создают и редактируют туры, загружают изображения и обмениваются данными через CSV.',
  });

  await goto(`${APP_URL}/admin/events`, 2200);
  await capture({
    chapter: 'Администрирование',
    title: 'Управление мероприятиями',
    note: 'Публикация новостей, акций, событий и изображений.',
    duration: 7,
    narration: 'Отдельный модуль предназначен для наполнения раздела мероприятий, управления публикацией и медиафайлами.',
  });

  await goto(`${APP_URL}/admin/reports`, 2300);
  await capture({
    chapter: 'Отчётность',
    title: 'Центр выгрузок',
    note: 'Фильтры и экспорт управленческих данных в CSV и XLSX.',
    duration: 8,
    narration: 'Центр отчётности формирует выборки по ключевым сущностям и экспортирует их в CSV или XLSX.',
  });

  await setAuth(analyst);
  await goto(`${APP_URL}/admin/analytics`, 4200);
  await capture({
    chapter: 'Аналитика',
    title: 'BI-панель и фильтры',
    note: 'Период, страна, город и оперативные показатели.',
    duration: 9,
    narration: 'Аналитическая панель позволяет выбирать период и направление, контролировать выручку, спрос, конверсию и качество данных.',
  });

  await scrollTo('.admin-analytics-workbench', -130);
  await capture({
    chapter: 'MetricBot',
    title: 'Прогноз и сигналы модели',
    note: 'Прогноз заявок и выручки на семь дней, уверенность и уровень риска.',
    duration: 10,
    narration: 'Локальный MetricBot анализирует историю бронирований, формирует прогноз на семь дней, оценивает уверенность и выделяет бизнес-сигналы.',
  });

  await scrollTo('.admin-ml-bot', -130);
  await capture({
    chapter: 'MetricBot',
    title: 'Объяснимость локального ML',
    note: 'Версия модели, размер выборки, метрики качества и важность признаков.',
    duration: 10,
    narration: 'Модель полностью локальна. Интерфейс показывает алгоритм, размер обучающей выборки, метрики качества, важность признаков и рекомендации.',
  });

  await goto(`${APP_URL}/admin/data`, 2600);
  await capture({
    chapter: 'Контроль данных',
    title: 'CSV-центр',
    note: 'Загрузка датасетов, проверка качества и паспорт данных.',
    duration: 8,
    narration: 'CSV-центр используется для загрузки датасетов, проверки структуры и качества данных перед аналитикой и машинным обучением.',
  });

  await setTitlePage(
    'Итог',
    'Единый рабочий цикл',
    'Пользователь выбирает или собирает тур, оформляет заявку, менеджер обрабатывает её, а аналитик получает показатели и ML-прогноз.',
  );
  await capture({
    chapter: 'Завершение',
    title: 'Система готова к работе',
    duration: 9,
    caption: false,
    narration: 'Таким образом, система охватывает весь цикл туристического агентства: от выбора тура до обработки заявки, отчётности и локального машинного обучения.',
  });
};

const formatTimestamp = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const writeNarration = (videoFile) => {
  let elapsed = 0;
  const rows = frames.map((frame) => {
    const start = formatTimestamp(elapsed);
    elapsed += frame.duration;
    const end = formatTimestamp(elapsed);
    return `### ${start}–${end} · ${frame.title}\n${frame.narration || frame.note}\n`;
  });

  const content = `# Сценарий видеодемонстрации Travel Agency

Итоговая длительность: **${formatTimestamp(elapsed)}**
Видеофайл: **${basename(videoFile)}**

Темп озвучки: спокойно, примерно 125–135 слов в минуту. Текст уже разбит по экранным сценам.

${rows.join('\n')}
`;
  writeFileSync(NARRATION_PATH, content, 'utf8');
  return elapsed;
};

const renderPage = (manifest) => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <title>Travel Agency video renderer</title>
  </head>
  <body style="margin:0;background:#000;overflow:hidden">
    <canvas id="video" width="1280" height="720"></canvas>
    <script>
      const frames = ${JSON.stringify(manifest)};
      const canvas = document.querySelector('#video');
      const context = canvas.getContext('2d', { alpha: false });
      const transitionMs = 650;
      const totalMs = frames.reduce((sum, frame) => sum + frame.duration * 1000, 0);
      const images = [];

      const loadImage = (src) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });

      const drawCover = (image, progress, alpha = 1) => {
        const zoom = 1 + progress * 0.018;
        const targetWidth = canvas.width * zoom;
        const targetHeight = canvas.height * zoom;
        context.globalAlpha = alpha;
        context.drawImage(
          image,
          (canvas.width - targetWidth) / 2,
          (canvas.height - targetHeight) / 2,
          targetWidth,
          targetHeight
        );
        context.globalAlpha = 1;
      };

      Promise.all(frames.map((frame) => loadImage('/frames/' + frame.file))).then((loaded) => {
        images.push(...loaded);
        const supportedTypes = [
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm'
        ];
        const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
        const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: 3200000
        });
        const chunks = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          await fetch('/upload', {
            method: 'POST',
            headers: {
              'Content-Type': blob.type,
              'X-Video-Extension': extension
            },
            body: blob
          });
          document.title = 'VIDEO_READY';
        };

        const startedAt = performance.now();
        recorder.start(1000);

        const render = (now) => {
          const elapsed = Math.min(now - startedAt, totalMs);
          let cursor = 0;
          let index = 0;
          while (
            index < frames.length - 1 &&
            elapsed >= cursor + frames[index].duration * 1000
          ) {
            cursor += frames[index].duration * 1000;
            index += 1;
          }

          const duration = frames[index].duration * 1000;
          const local = Math.max(0, elapsed - cursor);
          const progress = Math.min(1, local / duration);
          context.fillStyle = '#000';
          context.fillRect(0, 0, canvas.width, canvas.height);
          drawCover(images[index], progress, 1);

          if (index < frames.length - 1 && duration - local < transitionMs) {
            const fade = 1 - (duration - local) / transitionMs;
            drawCover(images[index + 1], 0, Math.max(0, Math.min(1, fade)));
          }

          if (elapsed < totalMs) {
            requestAnimationFrame(render);
          } else {
            setTimeout(() => recorder.stop(), 400);
          }
        };

        requestAnimationFrame(render);
      }).catch((error) => {
        document.title = 'VIDEO_ERROR';
        document.body.innerText = error.stack || String(error);
      });
    </script>
  </body>
</html>`;

const serveAndRender = async () => {
  let resolveUpload;
  let rejectUpload;
  const uploadComplete = new Promise((resolvePromise, rejectPromise) => {
    resolveUpload = resolvePromise;
    rejectUpload = rejectPromise;
  });

  const server = createServer((request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/render') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(renderPage(frames));
        return;
      }

      if (request.method === 'GET' && request.url?.startsWith('/frames/')) {
        const requestedFile = basename(decodeURIComponent(request.url.slice('/frames/'.length)));
        const framePath = join(FRAME_DIR, requestedFile);
        response.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        });
        createReadStream(framePath).pipe(response);
        return;
      }

      if (request.method === 'POST' && request.url === '/upload') {
        const extension = request.headers['x-video-extension'] === 'mp4' ? 'mp4' : 'webm';
        const outputPath = join(ARTIFACT_DIR, `travel_agency_demo.${extension}`);
        const output = createWriteStream(outputPath);
        request.pipe(output);
        output.on('finish', () => {
          response.writeHead(200, { 'Content-Type': 'text/plain' });
          response.end('ok');
          resolveUpload(outputPath);
        });
        output.on('error', rejectUpload);
        return;
      }

      response.writeHead(404);
      response.end('not found');
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
      rejectUpload(error);
    }
  });

  await new Promise((resolveListen) => server.listen(RENDER_PORT, '127.0.0.1', resolveListen));
  await goto(`http://127.0.0.1:${RENDER_PORT}/render`, 500);

  const totalSeconds = frames.reduce((sum, frame) => sum + frame.duration, 0);
  console.log(`Rendering ${formatTimestamp(totalSeconds)} video...`);

  const timeout = delay((totalSeconds + 120) * 1000).then(() => {
    throw new Error('Video rendering timed out.');
  });

  try {
    return await Promise.race([uploadComplete, timeout]);
  } finally {
    server.close();
  }
};

const cleanup = async () => {
  if (demoPlan?.id) {
    try {
      await api(`/tour-plans/${demoPlan.id}`, {
        method: 'DELETE',
        token: client.token,
      });
      console.log(`Temporary plan #${demoPlan.id} deleted.`);
    } catch (error) {
      console.warn(`Could not delete temporary plan: ${error.message}`);
    }
  }

  try {
    cdp?.close();
  } catch {
    // Ignore close failures.
  }

  if (chromeProcess && !chromeProcess.killed) {
    chromeProcess.kill();
    await delay(500);
  }

  if (chromeProcess && existsSync(PROFILE_DIR)) {
    rmSync(assertWorkspacePath(PROFILE_DIR), { recursive: true, force: true });
  }
};

try {
  demoPlan = await api('/tour-plans/', {
    method: 'POST',
    token: client.token,
    body: demoPlanPayload,
  });
  console.log(`Temporary plan #${demoPlan.id} created.`);

  await launchChrome();
  await buildScreens();

  writeFileSync(MANIFEST_PATH, JSON.stringify(frames, null, 2), 'utf8');
  const videoPath = await serveAndRender();
  const duration = writeNarration(videoPath);

  console.log(JSON.stringify({
    videoPath,
    narrationPath: NARRATION_PATH,
    manifestPath: MANIFEST_PATH,
    scenes: frames.length,
    durationSeconds: duration,
    duration: formatTimestamp(duration),
  }, null, 2));
} finally {
  await cleanup();
}
