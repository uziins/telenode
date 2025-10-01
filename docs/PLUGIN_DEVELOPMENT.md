# TeleNode Plugin Development Guide

This guide explains how to create, configure, and manage plugins for TeleNode.

## 🚀 Quick Start

### Creating a New Plugin

Use the CLI to generate a plugin template:

```bash
npm run plugin:create my-awesome-plugin -- --description "Does something awesome"
```

#### CLI Arguments for `plugin:create`

- `<name>`: Plugin directory and identifier (required).
- `-d, --description <description>`: Plugin description.
- `-a, --author <author>`: Plugin author.
- `-v, --visibility <visibility>`: Plugin visibility (`USER`, `ADMIN`, `ROOT`). Default: `USER`.
- `-t, --type <type>`: Plugin type (`NORMAL`, `PROXY`). Default: `NORMAL`.
- `-c, --category <category>`: Plugin category. Default: `general`.
- `-h, --help-text <help>`: Custom help text for the plugin.
- `--deps <deps>`: Comma-separated list of dependencies (`package@version`).

Example:
```bash
npm run plugin:create my-plugin -- -d "My plugin" -a "Your Name" -v ADMIN -t PROXY -c security -h "/start - Start\n/help - Help" --deps "lodash@4.17.21,axios"
```

### Basic Plugin Structure

```javascript
import Plugin from "../../src/plugin.js";

/**
 * MyAwesome Plugin
 * Does something awesome
 */
export default class MyAwesomePlugin extends Plugin {
    get commands() {
        return {
            hello: this.sayHello.bind(this),
            info: this.getInfo.bind(this)
        };
    }

    async sayHello({message, args}) {
        const name = args.join(" ") || message.from.first_name;
        return `Hello, ${name}! 👋`;
    }

    async getInfo({message}) {
        return {
            type: "text",
            text: "ℹ️ This is my awesome plugin!",
            options: { parse_mode: "Markdown" }
        };
    }
}
```

## 📋 Plugin Configuration

### Plugin Structure

Plugins extend the `Plugin` base class and must be exported as default.

```javascript
export default class YourPlugin extends Plugin {
    /**
     * Define available commands
     */
    get commands() {
        return {
            command1: this.handleCommand1.bind(this),
            command2: this.handleCommand2.bind(this),
        };
    }

    async handleCommand1({message, args}) {
        // Implementation
    }
}
```

### Plugin Metadata (`package.json`)

Plugin metadata is defined in `package.json`:

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "Does something awesome",
  "author": "Your Name",
  "plugin": {
    "displayName": "MyAwesomePlugin",
    "help": "`/hello` - Say hello\n`/info` - Get info",
    "visibility": "USER",
    "type": "NORMAL",
    "category": "general"
  }
}
```

#### Metadata Fields

- `name`: Plugin identifier (must be unique).
- `version`: Plugin version.
- `description`: Short description of the plugin.
- `author`: Author name.
- `plugin.displayName`: Display name for the plugin.
- `plugin.visibility`: Plugin visibility (`USER`, `ADMIN`, `ROOT`).
- `plugin.type`: Plugin type (`NORMAL`, `PROXY`).
- `plugin.category`: Plugin category.
- `plugin.help`: Help text shown to users.

### Visibility Levels

- `"USER"` - Available to all users.
- `"ADMIN"` - Available to admins and root users.
- `"ROOT"` - Available only to root users.

## 🔌 Proxy Plugins

Proxy plugins can intercept and modify events before they reach other plugins. Define them in `package.json`:

```json
{
  "name": "security-proxy",
  "plugin": {
    "type": "PROXY",
    "visibility": "ROOT"
  }
}
```

Example proxy plugin:

```javascript
export default class SecurityProxyPlugin extends Plugin {
    async proxy(eventName, eventData) {
        // Modify or filter events
        if (eventName === 'text' && eventData.message.text.includes('spam')) {
            return null; // Block this event
        }

        // Modify the event data
        eventData.message.text = eventData.message.text.toLowerCase();
        return eventData;
    }
}
```

## ⚡ Event Handling

Plugins can handle various Telegram events by implementing handler methods. The base `Plugin` class supports these events:

- `onMessage`
- `onText`
- `onAudio`
- `onDocument`
- `onPhoto`
- `onSticker`
- `onVideo`
- `onVoice`
- `onContact`
- `onLocation`
- `onCallbackQuery`
- ...and many more (see `src/plugin.js` for the full list).

Example:

```javascript
export default class MyPlugin extends Plugin {
    async onText({message}) {
        // Handle text messages
        return "You sent: " + message.text;
    }
}
```

## 📝 Defining Commands

Commands are defined in the `commands` getter. Each command maps to a handler function.

```javascript
get commands() {
    return {
        greet: this.greetUser.bind(this),
        info: this.showInfo.bind(this)
    };
}

async greetUser({message, args}) {
    return `Hello, ${args.join(" ") || message.from.first_name}!`;
}
```

## 🔄 Plugin Lifecycle

Plugins have lifecycle methods:

- `start()`: Called when the plugin is activated.
- `stop()`: Called when the plugin is deactivated or unloaded.

Override these methods if you need custom startup or cleanup logic.

```javascript
async start() {
    // Custom startup logic
}

async stop() {
    // Custom cleanup logic
}
```

## 🛠️ Testing Your Plugin

1. Create your plugin using the CLI.
2. Implement your logic in `plugins/<your-plugin>/index.js`.
3. Start TeleNode and verify your plugin is loaded.
4. Use Telegram to trigger your commands and events.
5. Check logs for errors or debug information.

## 📦 Managing Dependencies

Specify dependencies in your plugin's `package.json`. Use the CLI to install them:

```bash
npm run plugin:install my-awesome-plugin
```

## 📤 Publishing Plugins

To share your plugin:

1. Ensure your plugin directory contains `index.js`, `package.json`, and `README.md`.
2. Document usage and commands in `README.md`.
3. Publish your plugin code to a repository or share the plugin folder.

## 🧩 Plugin CLI Commands

- `plugin:create <name>`: Create a new plugin template.
- `plugin:install [plugin]`: Install dependencies for a plugin or all plugins.
- `plugin:check [plugin]`: Check dependency status.
- `plugin:remove <plugin>`: Remove a plugin.
- `plugin:list`: List all plugins.

## 🐞 Troubleshooting

- Check logs for errors (`logs/` directory or console output).
- Ensure your plugin exports a class extending `Plugin`.
- Verify `package.json` metadata is correct.
- Use the CLI to check and install dependencies.
- Restart TeleNode after adding or removing plugins.

## 📚 References

- [`src/plugin.js`](../src/plugin.js): Plugin base class and event list.
- [`src/pluginManager.js`](../src/pluginManager.js): Plugin loading and management.
- [`bin/plugin-cli.js`](../bin/plugin-cli.js): CLI tool for plugin management.

---
