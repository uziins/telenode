import configManager from "../../helpers/configManager.js";

export default class ConfigHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.pm = masterPlugin.pm;
        this.log = masterPlugin.log;
        this.config = configManager;
    }

    /**
     * Handle configuration menu
     */
    async handleConfigMenu({message}) {
        // Only root users can access config management
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized config access attempt by user ${message.from.id}`);
            return;
        }

        // Only process private messages
        if (message.chat.type !== 'private') {
            this.log.warn(`Config management can only be accessed in private messages`);
            return;
        }

        const stats = await this.config.getStats();

        let text = `⚙️ **Configuration Management**\n\n`;
        text += `📊 **Statistics:**\n`;
        text += `• Total configs: ${stats.total}\n`;
        text += `• Global configs: ${stats.global}\n`;
        text += `• Plugin configs: ${stats.plugins} plugins\n\n`;

        text += `🔧 **Available Commands:**\n`;
        text += `• \`/config set <key> <value>\` - Set configuration\n`;
        text += `• \`/config get <key>\` - Get configuration value\n`;
        text += `• \`/config delete <key>\` - Delete configuration\n`;
        text += `• \`/config list [prefix]\` - List configurations\n`;
        text += `• \`/config plugin <plugin> <key> <value>\` - Set plugin config\n`;

        text += `📝 **Examples:**\n`;
        text += `• \`/config set global.timezone Asia/Jakarta\`\n`;
        text += `• \`/config plugin weather api_key YOUR_API_KEY\`\n`;
        text += `• \`/config get plugins.weather.api_key\`\n`;
        text += `• \`/config list plugins.weather\``;

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }

    /**
     * Handle configuration set command
     */
    async handleConfigSet({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized config set attempt by user ${message.from.id}`);
            return;
        }

        if (args.length < 2) {
            return "❌ Usage: `/config set <key> <value>`\n\nExample: `/config set global.timezone Asia/Jakarta`";
        }

        const key = args[0];
        const value = args.slice(1).join(' ');

        try {
            // Try to parse as JSON for complex values
            let parsedValue;
            try {
                parsedValue = JSON.parse(value);
            } catch {
                parsedValue = value; // Keep as string if not valid JSON
            }

            const success = await this.config.set(key, parsedValue, true, {
                createdBy: message.from.username || message.from.id.toString()
            });

            if (!success) {
                return "❌ Failed to set configuration. Please try again.";
            }

            return `✅ **Configuration Updated**\n\n` +
                   `🔑 **Key:** \`${key}\`\n` +
                   `💾 **Value:** \`${typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue}\`\n` +
                   `🕒 **Time:** ${new Date().toLocaleString()}`;

        } catch (error) {
            this.log.error('Error setting configuration:', error);
            return `❌ Failed to set configuration: ${error.message}`;
        }
    }

    /**
     * Handle configuration get command
     */
    async handleConfigGet({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized config get attempt by user ${message.from.id}`);
            return;
        }

        if (args.length === 0) {
            return "❌ Usage: `/config get <key>`\n\nExample: `/config get plugins.weather.api_key`";
        }

        const key = args[0];
        const value = await this.config.get(key);

        if (value === null) {
            return `❌ **Configuration Not Found**\n\n🔑 **Key:** \`${key}\``;
        }

        // Hide sensitive values partially
        let displayValue = value;
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
            if (typeof value === 'string' && value.length > 8) {
                displayValue = value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
            } else {
                displayValue = '*'.repeat(8);
            }
        }

        return `✅ **Configuration Found**\n\n` +
               `🔑 **Key:** \`${key}\`\n` +
               `💾 **Value:** \`${typeof value === 'object' ? JSON.stringify(displayValue) : displayValue}\`\n` +
               `📊 **Type:** ${typeof value}`;
    }

    /**
     * Handle configuration delete command
     */
    async handleConfigDelete({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized config delete attempt by user ${message.from.id}`);
            return;
        }

        if (args.length === 0) {
            return "❌ Usage: `/config delete <key>`\n\nExample: `/config delete plugins.weather.api_key`";
        }

        const key = args[0];
        const existed = await this.config.has(key);

        if (!existed) {
            return `❌ **Configuration Not Found**\n\n🔑 **Key:** \`${key}\``;
        }

        const deleted = await this.config.delete(key);

        if (!deleted) {
            return "❌ Failed to delete configuration. Please try again.";
        }

        return `✅ **Configuration Deleted**\n\n` +
               `🔑 **Key:** \`${key}\`\n` +
               `🕒 **Time:** ${new Date().toLocaleString()}`;
    }

    /**
     * Handle configuration list command
     */
    async handleConfigList({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized config list attempt by user ${message.from.id}`);
            return;
        }

        const prefix = args.length > 0 ? args[0] : '';
        const configs = prefix ? await this.config.getByPrefix(prefix) : await this.config.export();
        const keys = Object.keys(configs);

        if (keys.length === 0) {
            return prefix ?
                `❌ **No configurations found with prefix:** \`${prefix}\`` :
                `❌ **No configurations found**`;
        }

        let text = `📋 **Configuration List**\n\n`;
        if (prefix) {
            text += `🔍 **Filter:** \`${prefix}*\`\n`;
        }
        text += `📊 **Found:** ${keys.length} items\n\n`;

        // Limit to first 20 items to avoid message length issues
        const limitedKeys = keys.slice(0, 20);

        limitedKeys.forEach(key => {
            const value = configs[key];
            let displayValue = value;

            // Hide sensitive values
            if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password')) {
                if (typeof value === 'string' && value.length > 8) {
                    displayValue = value.substring(0, 4) + '*'.repeat(Math.min(value.length - 8, 10)) + value.substring(value.length - 4);
                } else {
                    displayValue = '*'.repeat(8);
                }
            }

            text += `🔑 \`${key}\`\n`;
            text += `   💾 ${typeof value === 'object' ? JSON.stringify(displayValue).substring(0, 50) + '...' : displayValue}\n\n`;
        });

        if (keys.length > 20) {
            text += `... and ${keys.length - 20} more items\n`;
            text += `Use \`/config list ${prefix}\` with a more specific prefix to see more items.`;
        }

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }

    /**
     * Handle plugin configuration command
     */
    async handleConfigPlugin({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized plugin config attempt by user ${message.from.id}`);
            return;
        }

        if (args.length < 3) {
            return "❌ Usage: `/config plugin <plugin_name> <key> <value>`\n\n" +
                   "Examples:\n" +
                   "• `/config plugin weather api_key YOUR_API_KEY`\n" +
                   "• `/config plugin weather timeout 30`\n" +
                   "• `/config plugin quotes max_length 500`";
        }

        const pluginName = args[0];
        const configKey = args[1];
        const value = args.slice(2).join(' ');

        try {
            // Try to parse as JSON for complex values
            let parsedValue;
            try {
                parsedValue = JSON.parse(value);
            } catch {
                parsedValue = value; // Keep as string if not valid JSON
            }

            const success = await this.config.setPluginConfig(pluginName, configKey, parsedValue, true, {
                createdBy: message.from.username || message.from.id.toString()
            });

            if (!success) {
                return "❌ Failed to set plugin configuration. Please try again.";
            }

            return `✅ **Plugin Configuration Updated**\n\n` +
                   `🔌 **Plugin:** \`${pluginName}\`\n` +
                   `🔑 **Key:** \`${configKey}\`\n` +
                   `💾 **Value:** \`${typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue}\`\n` +
                   `🕒 **Time:** ${new Date().toLocaleString()}\n\n` +
                   `ℹ️ Plugin will use this value immediately (hot reload compatible)`;

        } catch (error) {
            this.log.error('Error setting plugin configuration:', error);
            return `❌ Failed to set plugin configuration: ${error.message}`;
        }
    }
}
