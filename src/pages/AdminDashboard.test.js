import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = jest.fn();
const mockOverview = {
  total_users: 47,
  online_users: 1,
  total_tours: 51,
  active_tours: 38,
  archived_tours: 13,
  total_bookings: 260,
  confirmed_bookings: 120,
  pending_bookings: 25,
  cancelled_bookings: 15,
  completed_bookings: 100,
  total_revenue: 24546000,
  average_rating: 4.8,
  reviews_count: 32,
};

const mockTourismAPI = {
  getAnalyticsOverview: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
  getCurrentUser: jest.fn(),
  sendHeartbeat: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../components/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 1, role: 'admin', first_name: 'Даниил' },
  }),
}));

jest.mock('../services/api', () => ({
  tourismAPI: mockTourismAPI,
}));

const AdminDashboard = require('./AdminDashboard').default;

describe('AdminDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockClear();
    Object.values(mockTourismAPI).forEach((mock) => mock.mockReset());
    mockTourismAPI.getAnalyticsOverview.mockResolvedValue({ data: mockOverview });
  });

  test('renders immediately and loads only the lightweight overview', async () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Центр управления Travel Agency')).toBeInTheDocument();
    expect(screen.queryByText('Загрузка панели...')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText('47').length).toBeGreaterThan(0));

    expect(mockTourismAPI.getAnalyticsOverview).toHaveBeenCalledTimes(1);
    expect(mockTourismAPI.getAnalyticsDashboard).not.toHaveBeenCalled();
    expect(mockTourismAPI.getCurrentUser).not.toHaveBeenCalled();
    expect(mockTourismAPI.sendHeartbeat).not.toHaveBeenCalled();
  });
});
