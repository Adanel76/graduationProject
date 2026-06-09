import App from './App';

test('exports main application component', () => {
  expect(App).toBeDefined();
  expect(typeof App).toBe('function');
});
