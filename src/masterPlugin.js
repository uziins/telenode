import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";
import { performanceMonitor } from "./helpers/performance.js";
import { globalCache } from "./helpers/cache.js";
import Marketplace from "./helpers/marketplace.js";

const PluginTbl = new PluginModel();

export default class MasterPlugin extends Plugin {
    constructor(listener, pm, auth) {
        super(listener, pm, auth);
        this.auth = auth;
        this.pm = pm;
        this.bot = pm.bot;
        this.marketplace = new Marketplace(pm.config);
    }

    get plugin() {
        return {
            name: "Master Plugin",
            description: "System management and monitoring plugin. This plugin provides system management, monitoring, and administrative functions.",
            help: "`/su` - Access system management panel\n" +
                "`/status` - Get system status report\n" +
                "`/plugins` - List all loaded plugins\n" +
                "`/marketplace` - Browse plugin marketplace\n" +
                "`/reload [identifier]` - Reload a specific plugin or all plugins\n" +
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
            marketplace: this.handleMarketplace.bind(this),
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

            // Use plugin info from database/cache instead of static getter
            const pluginInfo = this.pm.getPluginInfo(pluginName);
            if (!pluginInfo) continue;

            // Map string visibility to numeric constants
            let pluginVisibility;
            switch (pluginInfo.visibility?.toUpperCase()) {
                case 'ROOT':
                    pluginVisibility = Plugin.VISIBILITY.ROOT;
                    break;
                case 'ADMIN':
                    pluginVisibility = Plugin.VISIBILITY.ADMIN;
                    break;
                case 'USER':
                default:
                    pluginVisibility = Plugin.VISIBILITY.USER;
                    break;
            }

            // Check if user can access this plugin based on visibility level
            let canAccess = false;

            if (pluginVisibility === Plugin.VISIBILITY.USER) {
                canAccess = true;
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
                    } else if (par1 === 'confirm_update') {
                        const pluginName = par2;
                        const marketplacePlugin = await this.getPluginDetailInMarketplace(pluginName);
                        const detail = await PluginTbl.upsertPlugin(pluginName);

                        let updateText = "reinstall";
                        if (marketplacePlugin && marketplacePlugin.latest_version !== detail.version) {
                            updateText = `update to version ${marketplacePlugin.latest_version}`;
                        }

                        response = `⚠️ Are you sure you want to ${updateText} plugin "${pluginName}"?\n\nThis action will temporarily stop the plugin and may affect its current state.`;
                        keyboard = [
                            [
                                { text: "✅ Yes, Continue", callback_data: `plugin_management update ${pluginName}` },
                                { text: "❌ Cancel", callback_data: `plugin_management detail ${pluginName}` }
                            ]
                        ];
                    } else if (par1 === 'confirm_uninstall') {
                        const pluginName = par2;
                        response = `⚠️ Are you sure you want to uninstall plugin "${pluginName}"?\n\n🔴 This action cannot be undone and will permanently remove the plugin and all its data.`;
                        keyboard = [
                            [
                                { text: "🗑️ Yes, Uninstall", callback_data: `plugin_management uninstall ${pluginName}` },
                                { text: "❌ Cancel", callback_data: `plugin_management detail ${pluginName}` }
                            ]
                        ];
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
                    } else if (par1 === 'update') {
                        const pluginName = par2;
                        response = "⏳ Updating plugin...";

                        // Send immediate response
                        await this.bot.editMessageText(response, {
                            chat_id: chatId,
                            message_id: message.message.message_id,
                            parse_mode: "Markdown"
                        });

                        try {
                            // First, try to get plugin details from marketplace
                            const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginName);
                            if (detailsResult.success) {
                                // Uninstall current version first
                                const uninstallResult = await this.marketplace.uninstallPlugin(pluginName);
                                if (uninstallResult.success) {
                                    // Install the latest version
                                    const installResult = await this.marketplace.installPlugin(pluginName);
                                    if (installResult.success) {
                                        response = `✅ Plugin "${pluginName}" updated successfully!`;
                                        if (installResult.needsReload) {
                                            response += "\n\n⚠️ Please reload plugins to apply changes.";
                                        }
                                    } else {
                                        response = `❌ Update failed during installation: ${installResult.error}`;
                                    }
                                } else {
                                    response = `❌ Update failed during uninstall: ${uninstallResult.error}`;
                                }
                            } else {
                                response = `❌ Plugin not found in marketplace: ${detailsResult.error}`;
                            }
                        } catch (error) {
                            response = `❌ Update failed: ${error.message}`;
                        }
                        keyboard = await this.getPluginKeyboard();
                    } else if (par1 === 'uninstall') {
                        const pluginName = par2;
                        response = "⏳ Uninstalling plugin...";

                        // Send immediate response
                        await this.bot.editMessageText(response, {
                            chat_id: chatId,
                            message_id: message.message.message_id,
                            parse_mode: "Markdown"
                        });

                        try {
                            const uninstallResult = await this.marketplace.uninstallPlugin(pluginName);
                            if (uninstallResult.success) {
                                response = `✅ Plugin "${pluginName}" uninstalled successfully!`;
                                if (uninstallResult.needsReload) {
                                    response += "\n\n⚠️ Please reload plugins to complete removal.";
                                }
                            } else {
                                response = `❌ Uninstall failed: ${uninstallResult.error}`;
                            }
                        } catch (error) {
                            response = `❌ Uninstall failed: ${error.message}`;
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

                case 'marketplace':
                    if (par1 === 'detail') {
                        const pluginCode = par2;
                        const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginCode);
                        if (detailsResult.success) {
                            const plugin = detailsResult.data;
                            response = `🔌 *${plugin.name}*\n\n` +
                                     `📝 ${plugin.description}\n` +
                                     `👤 Author: ${plugin.author}\n` +
                                     `🏷️ Version: ${plugin.latest_version}\n` +
                                     `📥 Downloads: ${plugin.total_downloads}`;
                        } else {
                            response = `❌ Plugin details not found: ${detailsResult.error}`;
                        }
                        keyboard = await this.getMarketplaceDetailKeyboard(pluginCode);
                    } else if (par1 === 'confirm_install') {
                        const pluginCode = par2;
                        const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginCode);

                        if (detailsResult.success) {
                            const plugin = detailsResult.data;
                            response = `⚠️ Are you sure you want to install plugin "${plugin.name}"?\n\n` +
                                     `📝 Description: ${plugin.description}\n` +
                                     `👤 Author: ${plugin.author}\n` +
                                     `🏷️ Version: ${plugin.latest_version}`;
                        } else {
                            response = `⚠️ Are you sure you want to install this plugin?`;
                        }

                        keyboard = [
                            [
                                { text: "📥 Yes, Install", callback_data: `marketplace install ${pluginCode}` },
                                { text: "❌ Cancel", callback_data: `marketplace detail ${pluginCode}` }
                            ]
                        ];
                    } else if (par1 === 'confirm_reinstall') {
                        const pluginCode = par2;
                        const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginCode);

                        if (detailsResult.success) {
                            const plugin = detailsResult.data;
                            response = `⚠️ Are you sure you want to reinstall plugin "${plugin.name}"?\n\n` +
                                     `This will remove the current version and install the latest version.\n` +
                                     `📝 Latest Version: ${plugin.latest_version}`;
                        } else {
                            response = `⚠️ Are you sure you want to reinstall this plugin?`;
                        }

                        keyboard = [
                            [
                                { text: "🔄 Yes, Reinstall", callback_data: `marketplace install ${pluginCode}` },
                                { text: "❌ Cancel", callback_data: `marketplace detail ${pluginCode}` }
                            ]
                        ];
                    } else if (par1 === 'confirm_uninstall_marketplace') {
                        const pluginCode = par2;
                        response = `⚠️ Are you sure you want to uninstall plugin "${pluginCode}"?\n\n🔴 This action cannot be undone and will permanently remove the plugin and all its data.`;
                        keyboard = [
                            [
                                { text: "🗑️ Yes, Uninstall", callback_data: `marketplace uninstall ${pluginCode}` },
                                { text: "❌ Cancel", callback_data: `marketplace detail ${pluginCode}` }
                            ]
                        ];
                    } else if (par1 === 'page') {
                        const page = parseInt(par2) || 1;
                        const marketplaceResult = await this.marketplace.getMarketplacePlugins(page);

                        if (marketplaceResult.total > 0) {
                            response = `🛒 *Plugin Marketplace*\n📄 Page ${marketplaceResult.page} of ${marketplaceResult.totalPages}`;
                        } else {
                            response = "🛒 Plugin Marketplace";
                        }
                        keyboard = await this.getMarketplaceKeyboard(page);
                    } else if (par1 === 'install') {
                        const pluginCode = par2;
                        response = "⏳ Installing plugin...";

                        // Send immediate response
                        await this.bot.editMessageText(response, {
                            chat_id: chatId,
                            message_id: message.message.message_id,
                            parse_mode: "Markdown"
                        });

                        // Install plugin
                        const installResult = await this.marketplace.installPlugin(pluginCode);
                        if (installResult.success) {
                            response = `✅ Plugin "${installResult.pluginName}" installed successfully!`;
                            if (installResult.needsReload) {
                                response += "\n\n⚠️ Please reload plugins to activate.";
                            }
                        } else {
                            response = `❌ Installation failed: ${installResult.error}`;
                        }
                        keyboard = await this.getMarketplaceKeyboard();
                    } else if (par1 === 'uninstall') {
                        const pluginName = par2;
                        const uninstallResult = await this.marketplace.uninstallPlugin(pluginName);
                        if (uninstallResult.success) {
                            response = `✅ Plugin "${pluginName}" uninstalled successfully!`;
                            if (uninstallResult.needsReload) {
                                response += "\n\n⚠️ Please reload plugins to complete removal.";
                            }
                        } else {
                            response = `❌ Uninstall failed: ${uninstallResult.error}`;
                        }
                        keyboard = await this.getPluginKeyboard();
                    } else {
                        const marketplaceResult = await this.marketplace.getMarketplacePlugins(1);

                        if (marketplaceResult.total > 0) {
                            response = `🛒 *Plugin Marketplace*\n📄 Page ${marketplaceResult.page} of ${marketplaceResult.totalPages}`;
                        } else {
                            response = "🛒 Plugin Marketplace";
                        }
                        keyboard = await this.getMarketplaceKeyboard(1);
                    }
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
                { text: "🔌 Plugin Management", callback_data: "plugin_management" }
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
                row.push({text: `${pl.name} ${status}`, callback_data: `plugin_management ${command} ${pl.identifier}`})
            }
            keyboard.push(row)
        }
        keyboard.push([
            { text: "🔄 Reload All", callback_data: "reload_all_plugins" },
            { text: "➕ Add Plugin", callback_data: "marketplace" }
        ])
        keyboard.push([
            { text: "🔙 Back", callback_data: "main_menu" }
        ]);
        return keyboard;
    }

    async getPluginDetailKeyboard(pluginName) {
        const detail = await PluginTbl.upsertPlugin(pluginName);

        const actionButton = detail.is_active ?
            { text: "❌ Deactivate", callback_data: `plugin_management deactivate ${pluginName}` } :
            { text: "✅ Activate", callback_data: `plugin_management activate ${pluginName}` };

        // Check if plugin is available in marketplace for updates
        const marketplacePlugin = await this.getPluginDetailInMarketplace(pluginName);

        let keyboard = [[actionButton]];

        if (marketplacePlugin) {
            let installText = `🔄 Reinstall`
            if (marketplacePlugin.latest_version !== detail.version) {
                installText = `🔄 Update to ${marketplacePlugin.latest_version}`;
            }
            keyboard.push([
                { text: installText, callback_data: `plugin_management confirm_update ${pluginName}` }
            ]);
        }

        keyboard.push([
            { text: "🗑️ Uninstall", callback_data: `plugin_management confirm_uninstall ${pluginName}` }
        ]);

        keyboard.push([
            { text: "🔙 Back to Plugins", callback_data: "plugin_management" }
        ]);

        return keyboard;
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

    async handleMarketplace({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to marketplace`);
            return;
        }

        return {
            type: "text",
            text: "🛒 Plugin Marketplace",
            options: {
                reply_markup: {
                    inline_keyboard: await this.getMarketplaceKeyboard()
                }
            }
        };
    }

    async getMarketplaceKeyboard(page = 1) {
        try {
            const marketplaceResult = await this.marketplace.getMarketplacePlugins(page);
            const availablePlugins = marketplaceResult.success ? marketplaceResult.data.plugins : [];
            const pagination = marketplaceResult.success ? marketplaceResult.data.total : 0;

            const btnPerRow = 2;
            let keyboard = [];

            if (availablePlugins.length > 0) {
                for (let i = 0; i < availablePlugins.length; i += btnPerRow) {
                    let row = [];
                    for (let j = 0; j < btnPerRow && i + j < availablePlugins.length; j++) {
                        let pl = availablePlugins[i + j];
                        row.push({
                            text: `${pl.name} - ${pl.author}`,
                            callback_data: `marketplace detail ${pl.code}`
                        });
                    }
                    keyboard.push(row);
                }

                if (pagination && (marketplaceResult.data.prevPage || marketplaceResult.data.nextPage)) {
                    let paginationRow = [];

                    if (marketplaceResult.data.prevPage) {
                        paginationRow.push({ text: "◀️ Prev", callback_data: `marketplace page ${page - 1}` });
                    }

                    if (marketplaceResult.data.nextPage) {
                        paginationRow.push({ text: "Next ▶️", callback_data: `marketplace page ${page + 1}` });
                    }

                    keyboard.push(paginationRow);
                }
            } else {
                keyboard.push([
                    { text: "📭 No plugins available", callback_data: "marketplace" }
                ]);
            }

            keyboard.push([
                { text: "🔙 Back to Plugins", callback_data: "plugin_management" }
            ]);

            return keyboard;
        } catch (error) {
            this.log.error('Error loading marketplace keyboard:', error);
            return [
                [{ text: "❌ Error loading marketplace", callback_data: "marketplace" }],
                [{ text: "🔙 Back to Plugins", callback_data: "plugin_management" }]
            ];
        }
    }

    async getMarketplaceDetailKeyboard(pluginId) {
        try {
            // Check if plugin is already installed
            const installedPlugin = await PluginTbl.getPlugin(pluginId);

            let actionButtons = [];

            if (installedPlugin) {
                // Plugin is already installed, check version
                const marketplaceResult = await this.marketplace.getMarketplacePluginDetails(pluginId);
                if (marketplaceResult.success) {
                    const marketplacePlugin = marketplaceResult.data;
                    const installedVersion = installedPlugin.version || '1.0.0';
                    const marketplaceVersion = marketplacePlugin.version || '1.0.0';

                    if (installedVersion !== marketplaceVersion) {
                        // Different version - show Update with confirmation
                        actionButtons.push({ text: "🔄 Update", callback_data: `marketplace confirm_reinstall ${pluginId}` });
                      } else {
                        // Same version - show Reinstall with confirmation
                        actionButtons.push({ text: "🔄 Reinstall", callback_data: `marketplace confirm_reinstall ${pluginId}` });
                      }
                } else {
                    // Cannot get marketplace details, default to reinstall with confirmation
                    actionButtons.push({ text: "🔄 Reinstall", callback_data: `marketplace confirm_reinstall ${pluginId}` });
                }

                // Always show uninstall if plugin is already installed - with confirmation
                actionButtons.push({ text: "🗑️ Uninstall", callback_data: `marketplace confirm_uninstall_marketplace ${pluginId}` });
            } else {
                // Plugin is not installed yet - show Install with confirmation
                actionButtons.push({ text: "📥 Install", callback_data: `marketplace confirm_install ${pluginId}` });
            }

            return [
                actionButtons,
                [
                    { text: "🔙 Back to Marketplace", callback_data: "marketplace" },
                    { text: "🏠 Main Menu", callback_data: "main_menu" }
                ]
            ];
        } catch (error) {
            this.log.error('Error generating marketplace detail keyboard:', error);
            // Fallback to default button if error occurs
            return [
                [
                    { text: "📥 Install", callback_data: `marketplace confirm_install ${pluginId}` }
                ],
                [
                    { text: "🔙 Back to Marketplace", callback_data: "marketplace" },
                    { text: "🏠 Main Menu", callback_data: "main_menu" }
                ]
            ];
        }
    }

    /**
     * Get plugin details from the marketplace if available.
     */
    async getPluginDetailInMarketplace(pluginName) {
        try {
            const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginName);
            return detailsResult.data;
        } catch (error) {
            this.log.debug(`Plugin ${pluginName} not found in marketplace:`, error);
            return false;
        }
    }
}
