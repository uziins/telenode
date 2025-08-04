import { jest } from '@jest/globals';
import Plugin from '../src/plugin.js';

describe('Plugin Base Class', () => {
  let plugin;
  let mockBot;
  let mockAuth;
  let mockListener;

  beforeEach(() => {
    mockBot = {
      sendMessage: jest.fn(),
      sendPhoto: jest.fn(),
      sendDocument: jest.fn()
    };

    mockAuth = {
      isGranted: jest.fn().mockResolvedValue(true)
    };

    mockListener = {
      on: jest.fn(),
      removeListener: jest.fn()
    };

    class TestPlugin extends Plugin {
      get commands() {
        return {
          test: this.testCommand.bind(this)
        };
      }

      async testCommand({ message, args }) {
        return 'Test response';
      }
    }

    plugin = new TestPlugin(mockListener, mockBot, mockAuth);
  });

  test('should initialize plugin correctly', () => {
    expect(plugin).toBeInstanceOf(Plugin);
    expect(plugin.commands).toBeDefined();
    expect(typeof plugin.commands.test).toBe('function');
    expect(plugin.bot).toBe(mockBot);
    expect(plugin.auth).toBe(mockAuth);
  });

  test('should handle command execution', async () => {
    const result = await plugin.commands.test({
      message: global.mockTelegramMessage,
      args: ['arg1', 'arg2']
    });

    expect(result).toBe('Test response');
  });

  test('should send message correctly', async () => {
    mockBot.sendMessage.mockResolvedValue({ message_id: 123 });

    await plugin.sendMessage(123456789, 'Test message');

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123456789,
      'Test message',
      {}
    );
  });
});
