jest.mock('axios', () => {
  const instance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  return {
    create: jest.fn(() => instance),
    __mockInstance: instance,
  };
});

describe('api helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
  });

  test('builds tour image url with cache key', () => {
    const { buildTourImageUrl } = require('./api');

    const url = buildTourImageUrl(15, 'cache value');

    expect(url).toContain('/tours/15/image');
    expect(url).toContain('v=cache%20value');
  });

  test('returns stored url before legacy image data', () => {
    const { getTourCardImageSrc } = require('./api');

    const src = getTourCardImageSrc({
      image_data: 'YWJj',
      image_type: 'image/png',
      image_url: 'https://example.com/tour.jpg',
    });

    expect(src).toBe('https://example.com/tour.jpg');
  });

  test('resolves a stored media path through the backend', () => {
    const { BASE_URL, getTourCardImageSrc } = require('./api');

    const src = getTourCardImageSrc({
      image_url: '/media/tour-catalog/manchester.jpg',
    });

    expect(src).toBe(`${BASE_URL}/media/tour-catalog/manchester.jpg`);
  });

  test('returns existing data url without wrapping twice', () => {
    const { getTourCardImageSrc } = require('./api');

    const src = getTourCardImageSrc({
      image_data: 'data:image/webp;base64,abc',
      image_type: 'image/png',
    });

    expect(src).toBe('data:image/webp;base64,abc');
  });

  test('falls back to server image endpoint when tour has id only', () => {
    const { getTourCardImageSrc } = require('./api');

    const src = getTourCardImageSrc({ id: 9 });

    expect(src).toContain('/tours/9/image');
  });
});
