import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    LineChart: Mock,
    Line: () => null,
    BarChart: Mock,
    Bar: () => null,
    PieChart: Mock,
    Pie: Mock,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

const dashboard = {
  overview: {
    total_users: 10,
    online_users: 1,
    total_tours: 5,
    active_tours: 4,
    archived_tours: 1,
    total_bookings: 20,
    confirmed_bookings: 8,
    pending_bookings: 5,
    cancelled_bookings: 3,
    completed_bookings: 4,
    total_revenue: 1000000,
    average_check: 50000,
    average_rating: 4.7,
    reserved_seats: 20,
    available_seats: 40,
    occupancy_rate: 33.3,
  },
  users_by_day: [],
  bookings_by_day: [{ date: '2026-04-01', value: 3 }],
  revenue_by_day: [{ date: '2026-04-01', value: 150000 }],
  booking_statuses: [],
  bookings_by_country: [],
  bookings_by_city: [],
  top_tours: [],
  capacity_by_tour: [],
  payment_statuses: [],
  payment_methods: [],
  weekday_demand: [{ name: 'Сб', value: 13, revenue: 300000 }],
  price_segments: [],
  duration_segments: [],
  conversion_funnel: [],
  analyst_insights: [],
  period_comparison: null,
  data_quality: [{ name: 'Туры без координат', value: 2, severity: 'warning', description: 'Проверьте карты' }],
  ml_assistant: {
    model_name: 'MetricBot RandomForest',
    model_type: 'supervised_regression_random_forest',
    status: 'ready',
    training_samples: 8,
    confidence: 49.6,
    risk_level: 'high',
    summary: 'MetricBot ожидает рост спроса и контролирует риски отмен.',
    forecast_next_7_days: [{ date: '2026-04-25', bookings: 4, revenue: 200000 }],
    signals: [{ title: 'Динамика спроса', value: '+12%', text: 'Спрос растёт', tone: 'good' }],
    recommendations: ['Проверить туры с высокой отменой'],
    accuracy_metrics: [{ name: 'MAE заявок', value: 0.8, unit: 'заявок', description: 'Ошибка на holdout-окне' }],
    feature_importance: [{ feature: 'Среднее за 7 дней', importance: 32.4, description: 'Короткий темп спроса' }],
    algorithm_notes: ['Локальный supervised learning без внешних API.'],
    local_model_files: ['metricbot_bundle.joblib'],
    model_version: 'metricbot-local-v2',
    training_window_start: '2026-01-01',
    training_window_end: '2026-04-25',
  },
};

const mockTourismAPI = {
  getCurrentUser: jest.fn(),
  sendHeartbeat: jest.fn(),
  getTours: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
  trainMlAssistant: jest.fn(),
};

jest.mock('../services/api', () => ({
  tourismAPI: mockTourismAPI,
}));

const AdminAnalytics = require('./AdminAnalytics').default;

describe('AdminAnalytics', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockTourismAPI.getCurrentUser.mockResolvedValue({ data: { id: 1, role: 'analyst', first_name: 'Даниил' } });
    mockTourismAPI.sendHeartbeat.mockResolvedValue({ data: { status: 'online' } });
    mockTourismAPI.getTours.mockResolvedValue({ data: [{ id: 1, title: 'Сочи', country: 'Россия', city: 'Сочи' }] });
    mockTourismAPI.getAnalyticsDashboard.mockResolvedValue({ data: dashboard });
    mockTourismAPI.trainMlAssistant.mockResolvedValue({ data: dashboard.ml_assistant });
  });

  test('renders BI workbench with MetricBot summary before operational blocks', async () => {
    render(<AdminAnalytics />);

    await waitFor(() => expect(screen.getByText('Краткая сводка модели')).toBeInTheDocument());

    expect(screen.getByText('Оперативная картина')).toBeInTheDocument();
    expect(screen.getByText('Контроль данных')).toBeInTheDocument();
    expect(screen.getAllByText(/MetricBot ожидает рост спроса/).length).toBeGreaterThan(0);

    const text = document.body.textContent;
    expect(text.indexOf('Краткая сводка модели')).toBeLessThan(text.indexOf('Оперативная картина'));
    expect(text.indexOf('Оперативная картина')).toBeLessThan(text.indexOf('Контроль данных'));
  });

  test('renders analytics filters and key metric labels', async () => {
    render(<AdminAnalytics />);

    await waitFor(() => expect(screen.getByText('Аналитика системы')).toBeInTheDocument());

    expect(screen.getByText('Дата от')).toBeInTheDocument();
    expect(screen.getByText('Статус')).toBeInTheDocument();
    expect(screen.getByText('Прогноз заявок')).toBeInTheDocument();
    expect(screen.getByText('Качество обучения')).toBeInTheDocument();
    expect(screen.getByText('Что влияет на прогноз')).toBeInTheDocument();
    expect(screen.getByText('Проблемы данных')).toBeInTheDocument();
  });
});
