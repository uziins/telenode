import { jest } from '@jest/globals';
import Auth from '../src/helpers/auth.js';

// Mock the dependencies
jest.mock('../src/config.js', () => ({
  BOT_SUDOERS: [123456789],
  cache: { ttl: 60, maxSize: 1000 },
  APP_NAME: 'TestApp',
  LOG_LEVEL: 'error'
}));

jest.mock('../src/models/authorizations.js');
jest.mock('../src/models/users.js');
jest.mock('../src/models/chats.js');

describe('Auth Helper', () => {
  let auth;

  beforeEach(async () => {
    jest.clearAllMocks();
    auth = new Auth();

    // Mock the internal methods that isGranted actually uses
    auth.checkChatPermissions = jest.fn();
    auth.checkUserPermissions = jest.fn();
    auth.getFromCache = jest.fn().mockReturnValue(null); // No cache hit
    auth.setCache = jest.fn();
  });

  afterEach(() => {
    if (auth.cacheCleanupInterval) {
      clearInterval(auth.cacheCleanupInterval);
    }
  });

  test('should grant access to authorized users', async () => {
    const mockMessage = {
      from: { id: 123456789, username: 'admin' },
      chat: { id: -123456789, type: 'group' }
    };

    auth.checkChatPermissions.mockResolvedValue(true);
    auth.checkUserPermissions.mockResolvedValue(true);

    const result = await auth.isGranted(mockMessage);

    expect(result).toBe(true);
    expect(auth.checkChatPermissions).toHaveBeenCalledWith(mockMessage.chat);
    expect(auth.checkUserPermissions).toHaveBeenCalledWith(mockMessage.from);
  });

  test('should deny access to unauthorized users', async () => {
    const mockMessage = {
      from: { id: 987654321, username: 'hacker' },
      chat: { id: -987654321, type: 'group' }
    };

    auth.checkChatPermissions.mockResolvedValue(true);
    auth.checkUserPermissions.mockResolvedValue(false);

    const result = await auth.isGranted(mockMessage);

    expect(result).toBe(false);
    expect(auth.checkChatPermissions).toHaveBeenCalledWith(mockMessage.chat);
    expect(auth.checkUserPermissions).toHaveBeenCalledWith(mockMessage.from);
  });
});
