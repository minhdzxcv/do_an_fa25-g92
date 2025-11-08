import 'reflect-metadata';

// Mock bcrypt before any imports
jest.mock('bcrypt', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
}));

// Mock environment variables
process.env.JWT_SECRET = '1234567890abcdef1234567890abcdef';
process.env.EXPIRE_TIME_ACCESS = '1h';
process.env.EXPIRE_TIME_REFRESH = '7d';
process.env.PASSWORD_MYSQL = 'root';
process.env.CLOUDINARY_CLOUD_NAME = 'dlf04wlnw';
process.env.CLOUDINARY_API_KEY = '991518719233217';
process.env.CLOUDINARY_API_SECRET = '8cRvGScWMP0w0rQBQbrBqy8hUHo';

// Global test setup
beforeAll(async () => {
    // Setup code that runs before all tests
});

afterAll(async () => {
    // Cleanup code that runs after all tests
});

beforeEach(() => {
    // Setup code that runs before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Cleanup code that runs after each test
});
