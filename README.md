# TeleNode

A high-performance, plugin-based Telegram Bot framework built with Node.js. TeleNode provides a robust foundation for building scalable Telegram bots with advanced monitoring, caching, and plugin management capabilities.

## ✨ Features

- **Plugin-Based Architecture**: Modular design for easy extension and customization
- **High Performance**: Built-in caching and performance monitoring
- **Advanced Monitoring**: Real-time health checks and performance metrics
- **Hot Plugin Management**: Load, unload, and reload plugins without restarting
- **Role-Based Access Control**: Granular permission system (User/Admin/Root levels)
- **Rate Limiting**: Built-in protection against spam and abuse
- **Database Integration**: MySQL support with connection pooling
- **Marketplace Support**: Plugin marketplace for easy discovery and installation
- **Process Management**: PM2 integration for production deployment
- **Webhook & Polling**: Flexible update modes for different deployment scenarios

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- MySQL 5.7 or higher
- npm 8.0.0 or higher

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/telenode.git
   cd telenode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   npm run setup env
   ```

4. **Setup database**
   ```bash
   npm run setup db
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

| Variable        | Description                           | Default    | Required |
|-----------------|---------------------------------------|------------|----------|
| `BOT_TOKEN`     | Telegram Bot API token                | -          | ✓        |
| `BOT_SUDOERS`   | Comma-separated list of root user IDs | -          | ✓        |
| `DB_HOST`       | MySQL database host                   | localhost  | ✓        |
| `DB_PORT`       | MySQL database port                   | 3306       | ✓        |
| `DB_DATABASE`   | Database name                         | -          | ✓        |
| `DB_USER`       | Database username                     | -          | ✓        |
| `DB_PASSWORD`   | Database password                     | -          | ✓        |
| `UPDATE_MODE`   | Bot update mode (polling/webhook)     | polling    | -        |
| `WEBHOOK_URL`   | Webhook URL for webhook mode          | -          | -        |
| `APP_PORT`      | Application port                      | 8001       | ✓        |
| `LOG_LEVEL`     | Logging level                         | info       | -        |

### Interactive Setup

Run the interactive configuration wizard:

```bash
npm run setup env
```

This will guide you through setting up all required configuration values.

## 🔌 Plugin Development

### Directory Structure

```
plugins/
├── my-plugin/
│   ├── index.js        # Main plugin file
│   ├── package.json    # Plugin metadata
│   └── README.md       # Plugin documentation
└── ...
```

### Creating a Plugin

Use the CLI tool to generate a new plugin:

```bash
npm run plugin:create my-plugin -- --description "My awesome plugin"
```

#### CLI Options

- `-d, --description <desc>`: Plugin description
- `-a, --author <author>`: Plugin author
- `-v, --visibility <USER|ADMIN|ROOT>`: Plugin visibility (default: USER)
- `-t, --type <NORMAL|PROXY>`: Plugin type (default: NORMAL)
- `-c, --category <category>`: Plugin category (default: general)
- `-h, --help-text <help>`: Custom help text
- `--deps <deps>`: Comma-separated dependencies (`package@version`)

### Basic Plugin Structure

```javascript
import Plugin from "../../src/plugin.js";

/**
 * MyPlugin
 * A sample plugin
 */
export default class MyPlugin extends Plugin {
    /**
     * Plugin commands
     */
    get commands() {
        return {
            hello: this.sayHello.bind(this)
        };
    }

    /**
     * Say hello command handler
     */
    async sayHello({message, args}) {
        return `Hello, ${message.from.first_name}!`;
    }

    // Event handlers
    async onText({message}) {
        if (message.text.includes("ping")) {
            return "pong";
        }
    }
}
```

### Plugin Metadata (`package.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0", 
  "description": "A sample plugin",
  "author": "Your Name",
  "plugin": {
    "displayName": "MyPlugin",
    "visibility": "USER",
    "type": "NORMAL",
    "help": "`/hello` - Say hello"
  }
}
```

#### Metadata Fields

- `name`: Plugin identifier (unique)
- `version`: Plugin version
- `description`: Short description
- `author`: Author name
- `plugin.displayName`: Display name
- `plugin.visibility`: `USER`, `ADMIN`, or `ROOT`
- `plugin.type`: `NORMAL` or `PROXY`
- `plugin.help`: Help text

### Plugin Visibility Levels

- `"USER"` - Accessible to all users
- `"ADMIN"` - Accessible to admins and root users
- `"ROOT"` - Accessible only to root users

### Available Event Handlers

```javascript
// Message events
onMessage, onText, onPhoto, onVideo, onAudio, onDocument, onVoice, onSticker

// Chat events  
onNewChatMembers, onLeftChatMember, onNewChatTitle, onNewChatPhoto

// Interactive events
onCallbackQuery, onInlineQuery, onChosenInlineResult

// ...see docs/PLUGIN_DEVELOPMENT.md for full list
```

### Command Return Types

Commands can return:

```javascript
// Simple text
return "Hello World";

// Typed response
return {
    type: "photo",
    photo: "https://example.com/image.jpg",
    options: { caption: "A beautiful image" }
};

// Status action
return {
    type: "chatAction", 
    action: "typing"
};
```

### Logging & Error Handling

- Use built-in logger for debug/info/error logs.
- Handle errors gracefully in plugin handlers.
- Use try/catch for async operations.

## 🛠️ Plugin Management

### CLI Commands

```bash
npm run plugin:create <name>
npm run plugin:install [plugin-name]
npm run plugin:check [plugin-name]
npm run plugin:list
npm run plugin:remove <name>
```

### Runtime Management

Master plugin commands:
- `/plugins` - List loaded plugins
- `/reload [plugin]` - Reload plugin(s)
- `/su` - System management panel

## 📊 Monitoring & Health

### Performance Monitoring

Built-in monitoring:

```bash
/status      # System status
/health      # Health check
/cache       # Cache statistics
```

### Health Endpoints

- `GET /health` - Application health status
- `GET /metrics` - Performance metrics (if enabled)

## 🎯 Production Deployment

### Using PM2

```bash
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
```

### Docker Deployment

Example `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 8001

CMD ["npm", "start"]
```

### Environment Security

- Never commit `.env` files
- Use environment-specific configs
- Secure bot token and DB credentials
- Enable rate limiting in production

## 🛒 Plugin Marketplace

Access via:

```bash
/marketplace
```

Features:
- Browse plugins
- Install/update plugins
- Manage installed plugins

## 📝 Examples

### Echo Plugin

```javascript
import Plugin from "../../src/plugin.js";

class Echo extends Plugin {
    get commands() {
        return {
            echo: ({args}) => args.join(" ") || "Nothing to echo"
        };
    }
}

export default Echo;
```

### Weather Plugin

```javascript
import Plugin from "../../src/plugin.js";

class Weather extends Plugin {
    get commands() {
        return {
            weather: this.getWeather.bind(this)
        };
    }

    async getWeather({message, args}) {
        const city = args.join(" ");
        if (!city) {
            return "Please provide a city name. Usage: /weather <city>";
        }
        // Integrate weather API here
        return `Weather for ${city}: Sunny, 25°C`;
    }
}

export default Weather;
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/yourusername/telenode.git
cd telenode
npm install
npm run dev
```

### Code Style

- Use ESLint
- Follow code patterns
- Add JSDoc for public APIs
- Write tests for new features

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [winston](https://github.com/winstonjs/winston)
- [express](https://github.com/expressjs/express)

## 📞 Support

- 📖 [Documentation](https://github.com/yourusername/telenode/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/telenode/issues)
- 💬 [Discussions](https://github.com/yourusername/telenode/discussions)

---

Made with ❤️ by the TeleNode community
