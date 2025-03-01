import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";
import { performanceMonitor } from "./helpers/performance.js";
import { globalCache } from "./helpers/cache.js";

const PluginTbl = new PluginModel();

export default class MasterPlugin extends Plugin {
    constructor(listener, pm, auth) {
        super(listener, pm, auth);
        this.auth = auth;
        this.pm = pm;
        this.bot = pm.bot;
    }

    get plugin() {
        return {
            name: "Master Plugin",
            description: "System management and monitoring plugin. This plugin provides system management, monitoring, and administrative functions.",
            help: "`/su` - Access system management panel\n" +
                "`/status` - Get system status report\n" +
                "`/plugins` - List all loaded plugins\n" +
                "`/reload [plugin_name]` - Reload a specific plugin or all plugins\n" +
                "`/cache` - View cache statistics\n" +
                "`/health` - Perform health check on the system",
            visibility: Plugin.VISIBILITY.ROOT,
            version: "2.0.0",
            author: "TeleNode Framework"
        };
    }

    get commands() {
        return {
            help: this.handleGlobalHelp.bind(this),
            su: this.handleSystemMenu.bind(this),
            status: this.handleSystemStatus.bind(this),
            plugins: this.handlePluginList.bind(this),
            reload: this.handlePluginReload.bind(this),
            cache: this.handleCacheStats.bind(this),
            health: this.handleHealthCheck.bind(this)
        };
    }

    async handleSystemMenu({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to system management panel`);
            return;
        }

        return {
            type: "text",
            text: "🔧 System Management Panel",
            options: {
                reply_markup: {
                    inline_keyboard: await this.getMainKeyboard()
                }
            }
        };
    }

    async handleSystemStatus({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to system status`);
            return;
        }

        const report = performanceMonitor.getPerformanceReport();
        const health = performanceMonitor.getHealthStatus();

        let statusText = `📊 *System Status Report*\n\n`;
        statusText += `🟢 Status: ${health.status.toUpperCase()}\n`;
        statusText += `⏰ Uptime: ${report.uptime}\n`;
        statusText += `🧠 Memory: ${report.memory.current.heapUsed}\n`;
        statusText += `📈 Response Time (P95): ${report.responseTime.p95?.toFixed(2)}ms\n`;
        statusText += `📊 Total Events: ${report.events.total}\n`;
        statusText += `❌ Total Errors: ${report.errors.total}\n`;

        if (health.issues.length > 0) {
            statusText += `\n⚠️ *Issues:*\n`;
            health.issues.forEach(issue => {
                statusText += `• ${issue}\n`;
            });
        }

        return {
            type: "text",
            text: statusText,
            options: { parse_mode: "Markdown" }
        };
    }

    async handlePluginList({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to plugin list`);
            return;
        }

        const loadedPlugins = this.pm.getLoadedPlugins();
        let text = `🔌 *Loaded Plugins (${loadedPlugins.length})*\n\n`;

        for (const pluginName of loadedPlugins) {
            const info = this.pm.getPluginInfo(pluginName);
            const status = this.pm.isPluginLoaded(pluginName) ? "🟢" : "🔴";
            text += `${status} ${info?.name || pluginName}\n`;
            if (info?.description) {
                text += `   └ ${info.description}\n`;
            }
        }

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }

    async handlePluginReload({message, args}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to plugin reload`);
            return;
        }

        if (args.length === 0) {
            // Reload all plugins
            try {
                await this.pm.reloadPlugins();
                return "✅ All plugins reloaded successfully.";
            } catch (error) {
                return `❌ Failed to reload plugins: ${error.message}`;
            }
        } else {
            // Reload specific plugin
            const pluginName = args[0];
            try {
                await this.pm.unloadPlugin(pluginName);
                await this.pm.loadSinglePlugin(pluginName);
                return `✅ Plugin "${pluginName}" reloaded successfully.`;
            } catch (error) {
                return `❌ Failed to reload plugin "${pluginName}": ${error.message}`;
            }
        }
    }

    async handleCacheStats({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to cache stats`);
            return;
        }

        const cacheStats = globalCache.getStats();
        const authStats = this.auth.getStats();

        let text = `🗃 *Cache Statistics*\n\n`;
        text += `🎯 Hit Rate: ${cacheStats.hitRate}\n`;
        text += `📦 Size: ${cacheStats.size}/${cacheStats.maxSize}\n`;
        text += `💾 Memory: ${cacheStats.memoryUsage}\n`;
        text += `📈 Hits: ${cacheStats.hits}\n`;
        text += `📉 Misses: ${cacheStats.misses}\n`;
        text += `🗑️ Evictions: ${cacheStats.evictions}\n\n`;

        text += `🔐 *Auth Cache*\n`;
        text += `📦 Size: ${authStats.cacheSize}/${authStats.maxCacheSize}\n`;
        text += `👥 Admins: ${authStats.adminCount}\n`;
        text += `🔑 Root Users: ${authStats.rootUsersCount}\n`;

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }

    async handleHealthCheck({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to health check`);
            return;
        }

        const health = performanceMonitor.getHealthStatus();
        const memStats = performanceMonitor.getMemoryStats();

        let text = `🏥 *Health Check Report*\n\n`;

        const statusEmoji = {
            'healthy': '🟢',
            'warning': '🟡',
            'unhealthy': '����'
        };

        text += `${statusEmoji[health.status]} Overall Status: ${health.status.toUpperCase()}\n\n`;

        text += `🧠 *Memory Trend:* ${memStats.trend}\n`;
        text += `⚡ *Response Time (P95):* ${health.checks.responseTime}ms\n`;
        text += `❌ *Error Rate:* ${health.checks.errorRate}\n\n`;

        if (health.issues.length > 0) {
            text += `⚠️ *Issues Detected:*\n`;
            health.issues.forEach(issue => {
                text += `• ${issue}\n`;
            });
        } else {
            text += `✅ No issues detected`;
        }

        return {
            type: "text",
            text: text,
            options: { parse_mode: "Markdown" }
        };
    }

    async handleGlobalHelp({message}) {
        const userId = message.from.id;

        let helpText = ``;

        // Get all loaded plugins
        const loadedPlugins = this.pm.getLoadedPlugins();
        const accessiblePlugins = [];

        for (const pluginName of loadedPlugins) {
            const plugin = this.pm.plugins.get(pluginName);
            if (!plugin) continue;

            const pluginInfo = plugin.constructor.plugin;
            const pluginVisibility = pluginInfo.visibility;

            // Check if user can access this plugin based on visibility level
            let canAccess = false;

            if (pluginVisibility === Plugin.VISIBILITY.USER) {
                canAccess = true; // Everyone can access USER level plugins
            } else if (pluginVisibility === Plugin.VISIBILITY.ADMIN) {
                canAccess = this.auth.isAdmin(userId) || this.auth.isRoot(userId);
            } else if (pluginVisibility === Plugin.VISIBILITY.ROOT) {
                canAccess = this.auth.isRoot(userId);
            }

            if (canAccess) {
                accessiblePlugins.push({
                    name: pluginInfo.name,
                    help: pluginInfo.help || 'No help available',
                    visibility: pluginVisibility
                });
            }
        }

        if (accessiblePlugins.length > 0) {
            // Group plugins by access level for better presentation
            const userPlugins = accessiblePlugins.filter(p =>
                p.visibility === Plugin.VISIBILITY.USER || p.visibility === Plugin.VISIBILITY.VISIBLE);
            const adminPlugins = accessiblePlugins.filter(p =>
                p.visibility === Plugin.VISIBILITY.ADMIN);
            const rootPlugins = accessiblePlugins.filter(p =>
                p.visibility === Plugin.VISIBILITY.ROOT);

            if (userPlugins.length > 0) {
                helpText += `👥 *User Help:*\n`;
                for (const plugin of userPlugins) {
                    helpText += `🔹 *${plugin.name}*\n${plugin.help}\n\n`;
                }
            }

            if (adminPlugins.length > 0 && (this.auth.isAdmin(userId) || this.auth.isRoot(userId))) {
                helpText += `🛡️ *Admin Help:*\n`;
                for (const plugin of adminPlugins) {
                    helpText += `🔹 *${plugin.name}*\n${plugin.help}\n\n`;
                }
            }

            if (((rootPlugins.length > 0 && this.auth.isRoot(userId)) || this.auth.isRoot(userId)) && message.chat?.type === 'private') {
                helpText += `👑 *Root Help:*\n`;
                // add master plugin help
                helpText += `🔹 *${this.plugin.name}*\n${this.plugin.help}\n\n`;
                for (const plugin of rootPlugins) {
                    helpText += `🔹 *${plugin.name}*\n${plugin.help}\n\n`;
                }
            }
        } else {
            if (this.auth.isRoot(userId) && message.chat?.type === 'private') {
                helpText += `👑 *Root Help:*\n`;
                helpText += `🔹 *${this.plugin.name}*\n${this.plugin.help}\n\n`;
            } else {
                helpText += `No accessible plugins available.\n\n`;
            }
        }

        return {
            type: "text",
            text: helpText,
            options: { parse_mode: "Markdown" }
        };
    }

    async onCommand({message, command, args, chat_id}) {
        performanceMonitor.incrementEvent('master_command');

        try {
            if (command === "su") {
                return await this.handleSystemMenu({message});
            }
        } catch (error) {
            performanceMonitor.recordError('master_command', error);
            throw error;
        }
    }

    async onCallbackQuery({message}) {
        if (!message.data) return;

        const callbackData = message.data;
        const userId = message.from.id;
        const chatId = message.message.chat.id;

        if (!this.auth.isRoot(userId)) {
            return this.bot.answerCallbackQuery(message.id, {
                text: "❌ Access denied",
                show_alert: true
            });
        }

        let [cmd, par1, par2] = message.data.split(" ");

        try {
            let response,keyboard;

            switch (cmd) {
                case 'main_menu':
                    response = "🔧 System Management Panel";
                    keyboard = await this.getMainKeyboard();
                    break;

                case 'system_status':
                    const report = performanceMonitor.getPerformanceReport();
                    response = `📊 System Status\nUptime: ${report.uptime}\nMemory: ${report.memory.current.heapUsed}`;
                    keyboard = await this.getBackKeyboard();
                    break;

                case 'plugin_management':
                    response = "🔌 Plugin Management";
                    if (par1 === 'detail') {
                        const pluginName = par2;
                        const pluginInfo = this.pm.getPluginInfo(pluginName);
                        if (pluginInfo) {
                            response = `🔧 Plugin: ${pluginInfo.name}\nDescription: ${pluginInfo.description}\nVersion: ${pluginInfo.version}\nAuthor: ${pluginInfo.author}`;
                        } else {
                            response = `❌ Plugin "${pluginName}" not found`;
                        }
                        keyboard = await this.getPluginDetailKeyboard(pluginName);
                    } else if (par1 === 'activate' || par1 === 'deactivate') {
                        const pluginName = par2;
                        const action = par1 === 'activate' ? 'activated' : 'deactivated';
                        try {
                            if (par1 === 'activate') {
                                await this.pm.activatePlugin(pluginName);
                            } else {
                                await this.pm.deactivatePlugin(pluginName);
                            }
                            response = `✅ Plugin "${pluginName}" ${action} successfully`;
                        } catch (error) {
                            response = `❌ Failed to ${action} plugin "${pluginName}": ${error.message}`;
                        }
                        keyboard = await this.getPluginKeyboard();
                    } else {
                        keyboard = await this.getPluginKeyboard();
                    }
                    break;

                case 'cache_management':
                    if (par1 === 'clear_cache') {
                        globalCache.clear();
                        response = "✅ Cache cleared successfully";
                        keyboard = await this.getCacheKeyboard();
                        break;
                    }
                    const statsResult = await this.handleCacheStats({message: {from: {id: userId}}});
                    response = "🗃 Cache Management";
                    response = statsResult.text;
                    keyboard = await this.getCacheKeyboard();
                    break;

                case 'health_check':
                    const healthResult = await this.handleHealthCheck({message: {from: {id: userId}}});
                    response = healthResult.text;
                    keyboard = await this.getBackKeyboard();
                    break;

                case 'reload_all_plugins':
                    await this.pm.reloadPlugins();
                    response = "✅ All plugins reloaded successfully";
                    keyboard = await this.getPluginKeyboard();
                    break;

                default:
                    response = "❌ Unknown command";
                    keyboard = await this.getMainKeyboard();
            }

            await this.bot.editMessageText(response, {
                chat_id: chatId,
                message_id: message.message.message_id,
                reply_markup: { inline_keyboard: keyboard },
                parse_mode: "Markdown"
            });

            await this.bot.answerCallbackQuery(message.id);

        } catch (error) {
            this.log.error('Error handling callback query:', error);
            await this.bot.answerCallbackQuery(message.id, {
                text: "❌ An error occurred",
                show_alert: true
            });
        }
    }

    async getMainKeyboard() {
        return [
            [
                { text: "📊 System Status", callback_data: "system_status" },
                { text: "🔌 Plugins", callback_data: "plugin_management" }
            ],
            [
                { text: "🗃 Cache", callback_data: "cache_management" },
                { text: "🏥 Health Check", callback_data: "health_check" }
            ]
        ];
    }

    async getPluginKeyboard() {
        const plugins = await PluginTbl.get();
        const btnPerRow = 2;
        let keyboard = [];
        for (let i = 0; i < plugins.length; i += btnPerRow) {
            let row = [];
            for (let j = 0; j < btnPerRow; j++) {
                let pl = plugins[i + j];
                if (!pl) break;
                let status = pl.is_active ? '☑️' : '✖️';
                let command = 'detail';
                row.push({text: `${pl.name} ${status}`, callback_data: `plugin_management ${command} ${pl.plugin_name}`})
            }
            keyboard.push(row)
        }
        keyboard.push([
            { text: "🔄 Reload All", callback_data: "reload_all_plugins" },
        ])
        keyboard.push([
            { text: "🔙 Back", callback_data: "main_menu" }
        ]);
        return keyboard;
    }

    async getPluginDetailKeyboard(pluginName) {
        const detail = await PluginTbl.getPlugin(pluginName)
        const actionButton = detail.is_active ?
            { text: "❌ Deactivate", callback_data: `plugin_management deactivate ${pluginName}` } :
            { text: "✅ Activate", callback_data: `plugin_management activate ${pluginName}` };
        return [
            [
                actionButton,
            ],
            [
                { text: "🔙 Back to Main", callback_data: "plugin_management" }
            ]
        ];
    }

    async getCacheKeyboard() {
        return [
            [
                { text: "🗑️ Clear Cache", callback_data: "cache_management clear_cache" }
            ],
            [
                { text: "🔙 Back to Main", callback_data: "main_menu" }
            ]
        ];
    }

    async getBackKeyboard() {
        return [
            [
                { text: "🔙 Back to Main", callback_data: "main_menu" }
            ]
        ];
    }
}
