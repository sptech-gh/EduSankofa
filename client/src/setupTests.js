import "@testing-library/jest-dom";

// Mock localStorage
const __localStorageState__ = {};

const localStorageMock = {
  getItem: jest.fn((key) => {
    const k = String(key);
    return Object.prototype.hasOwnProperty.call(__localStorageState__, k)
      ? __localStorageState__[k]
      : null;
  }),
  setItem: jest.fn((key, value) => {
    __localStorageState__[String(key)] = String(value);
  }),
  clear: jest.fn(() => {
    Object.keys(__localStorageState__).forEach((k) => {
      delete __localStorageState__[k];
    });
  }),
  removeItem: jest.fn((key) => {
    delete __localStorageState__[String(key)];
  }),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

const __originalConsoleWarn__ = console.warn;
console.warn = (...args) => {
  const first = args && args.length ? String(args[0]) : "";
  if (first.includes("React Router Future Flag Warning")) {
    return;
  }
  __originalConsoleWarn__(...args);
};

const __originalConsoleError__ = console.error;
console.error = (...args) => {
  const first = args && args.length ? String(args[0]) : "";
  if (
    first.includes("not wrapped in act") ||
    first.includes("Warning: An update to") ||
    first.includes("Failed to fetch users")
  ) {
    return;
  }
  __originalConsoleError__(...args);
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();

  // Reset fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});
