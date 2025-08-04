// Global test setup
import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_token';
process.env.DB_PATH = ':memory:';
process.env.LOG_LEVEL = 'error';

// Global test utilities
global.mockTelegramMessage = {
  message_id: 1,
  from: {
    id: 123456789,
    is_bot: false,
    first_name: 'Test',
    username: 'testuser'
  },
  chat: {
    id: 123456789,
    type: 'private'
  },
  date: Math.floor(Date.now() / 1000),
  text: '/test'
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
