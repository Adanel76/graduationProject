import { fireEvent, render, screen } from '@testing-library/react';
import TourCard from './TourCard';

const mockNavigate = jest.fn();
const mockAddToFavorites = jest.fn();
const mockRemoveFromFavorites = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../services/api', () => ({
  FALLBACK_TOUR_IMAGE: 'https://example.com/fallback.jpg',
  getTourCardImageSrc: (item) => (
    item.image_url
      ? `http://localhost:8000${item.image_url}`
      : `http://localhost:8000/tours/${item.id}/image`
  ),
}));

jest.mock('./FavoritesContext', () => ({
  useFavorites: () => ({
    favoriteIds: new Set(),
    addToFavorites: mockAddToFavorites,
    removeFromFavorites: mockRemoveFromFavorites,
  }),
}));

const tour = {
  id: 7,
  title: 'Сочи: море и горы',
  city: 'Сочи',
  country: 'Россия',
  price: 45000,
  duration: 7,
  rating: 4.8,
  review_count: 12,
  available_seats: 3,
  description: 'Описание тура',
};

describe('TourCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAddToFavorites.mockClear();
    mockRemoveFromFavorites.mockClear();
    window.localStorage.clear();
  });

  test('renders core tour information', () => {
    render(<TourCard tour={tour} />);

    expect(screen.getByText('Сочи: море и горы')).toBeInTheDocument();
    expect(screen.getByText('Сочи, Россия')).toBeInTheDocument();
    expect(screen.getByText(/45\s000 ₽/)).toBeInTheDocument();
    expect(screen.getByText('7 дн.')).toBeInTheDocument();
    expect(screen.getByText('★ 4.8')).toBeInTheDocument();
    expect(screen.getByText('мест: 3')).toBeInTheDocument();
  });

  test('resolves a stored media path through the backend', () => {
    render(
      <TourCard
        tour={{
          ...tour,
          image_url: '/media/tour-catalog/manchester.jpg',
        }}
      />
    );

    expect(screen.getByRole('img', { name: tour.title })).toHaveAttribute(
      'src',
      'http://localhost:8000/media/tour-catalog/manchester.jpg'
    );
  });

  test('opens tour detail page when card is clicked', () => {
    render(<TourCard tour={tour} />);

    fireEvent.click(screen.getByText('Сочи: море и горы'));

    expect(mockNavigate).toHaveBeenCalledWith('/tours/7');
  });

  test('redirects anonymous user to login when favorite is clicked', () => {
    render(<TourCard tour={tour} />);

    fireEvent.click(screen.getByRole('button', { name: /добавить в избранное/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(mockAddToFavorites).not.toHaveBeenCalled();
  });

  test('adds tour to favorites for authenticated user', () => {
    window.localStorage.setItem('token', 'token');
    render(<TourCard tour={tour} />);

    fireEvent.click(screen.getByRole('button', { name: /добавить в избранное/i }));

    expect(mockAddToFavorites).toHaveBeenCalledWith(7, tour);
  });
});
