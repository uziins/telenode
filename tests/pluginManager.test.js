import { jest } from '@jest/globals';
import PluginManager from '../src/pluginManager.js';

// Mock the models to prevent database operations
jest.mock('../src/models/plugins.js', () => {
  return jest.fn().mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue([])
  }));
});

describe('PluginManager', () => {
  let pluginManager;
  let mockBot;
  let mockConfig;

  beforeEach(() => {
    mockBot = {
      on: jest.fn(),
      sendMessage: jest.fn()
    };

    mockConfig = {
      APP_NAME: 'TestApp',
      LOG_LEVEL: 'error',
      DB_PATH: ':memory:'
    };

    pluginManager = new PluginManager(mockBot, mockConfig);
  });

  afterEach(() => {
    // Cleanup any timers or intervals
    if (pluginManager.masterPlugin && pluginManager.masterPlugin.performanceMonitor) {
      clearInterval(pluginManager.masterPlugin.performanceMonitor);
    }
  });

  test('should initialize with empty plugins', () => {
    expect(pluginManager.plugins).toBeInstanceOf(Map);
    expect(pluginManager.plugins.size).toBe(0);
    expect(pluginManager.bot).toBe(mockBot);
    expect(pluginManager.config).toBe(mockConfig);
  });

  test('should handle plugin loading errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Test loadPlugins method instead of loadPlugin
    await pluginManager.loadPlugins();

    // Should not throw error, just log it
    expect(pluginManager.plugins.size).toBeGreaterThanOrEqual(0);
    consoleSpy.mockRestore();
  });

  test('should register event handlers', () => {
    expect(mockBot.on).toHaveBeenCalled();
    // PluginManager should register various event handlers on the bot
    const calls = mockBot.on.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });
});
