import Plugin from "../plugin.js";
import Marketplace from "../helpers/marketplace.js";
import SystemHandler from "./handlers/systemHandler.js";
import PluginHandler from "./handlers/pluginHandler.js";
import CacheHandler from "./handlers/cacheHandler.js";
import HealthHandler from "./handlers/healthHandler.js";
import HelpHandler from "./handlers/helpHandler.js";
import MarketplaceHandler from "./handlers/marketplaceHandler.js";
import KeyboardManager from "./keyboardManager.js";

export default class MasterPlugin extends Plugin {
    constructor(listener, pm, auth) {
        super(listener, pm, auth);
        this.auth = auth;
        this.pm = pm;
        this.bot = pm.bot;
        this.marketplace = new Marketplace(pm.config);
        
        // Initialize handlers
        this.systemHandler = new SystemHandler(this);
        this.pluginHandler = new PluginHandler(this);
        this.cacheHandler = new CacheHandler(this);
        this.healthHandler = new HealthHandler(this);
        this.helpHandler = new HelpHandler(this);
        this.marketplaceHandler = new MarketplaceHandler(this);
        this.keyboardManager = new KeyboardManager(this);
    }

    get plugin() {
        return {
            name: "Master Plugin",
            description: "System management and monitoring plugin. This plugin provides system management, monitoring, and administrative functions.",
            help: "`/me` - Get your user information\n" +
                "`/su` - Access system management panel\n" +
                "`/status` - Get system status report\n" +
                "`/plugins` - List all loaded plugins\n" +
                "`/plugin <command> <plugin_name>` - Manage plugins (available command: `reload`, `disable`, `enable`, `install`)\n" +
                (this.pm.config.USE_PLUGIN_MARKETPLACE ? "`/marketplace` - Browse plugin marketplace\n" : "") +
                "`/cache` - View cache statistics\n" +
                "`/health` - Perform health check on the system",
            visibility: Plugin.VISIBILITY.ROOT,
            version: "2.0.0",
            author: "TeleNode Framework"
        };
    }

    get commands() {
        // Ensure handlers are initialized before binding commands
        if (!this.helpHandler || !this.systemHandler || !this.pluginHandler ||
            !this.marketplaceHandler || !this.cacheHandler || !this.healthHandler) {
            this.log?.warn('Handlers not yet initialized when commands getter was called');
            return {};
        }

        const commands = {
            help: this.helpHandler.handleGlobalHelp.bind(this.helpHandler),
            su: this.systemHandler.handleSystemMenu.bind(this.systemHandler),
            status: this.systemHandler.handleSystemStatus.bind(this.systemHandler),
            plugins: this.pluginHandler.handlePluginList.bind(this.pluginHandler),
            plugin: this.pluginHandler.handlePluginCommand.bind(this.pluginHandler),
            cache: this.cacheHandler.handleCacheStats.bind(this.cacheHandler),
            health: this.healthHandler.handleHealthCheck.bind(this.healthHandler),
            me: this.handleMe.bind(this)
        };

        // Only add marketplace command if marketplace is enabled
        if (this.pm.config.USE_PLUGIN_MARKETPLACE) {
            commands.marketplace = this.marketplaceHandler.handleMarketplace.bind(this.marketplaceHandler);
        }

        return commands;
    }

    async handleMe({ message }) {
        if (message.chat.type !== 'private') return;

        const { id: userId, username = "N/A", first_name: firstName = "N/A", last_name: lastName = "N/A", language_code: languageCode = "N/A" } = message.from;

        const text = `👤 *Your Info*\n\n` +
            `*User ID:* ${userId}\n` +
            `*Username:* @${username}\n` +
            `*First Name:* ${firstName}\n` +
            `*Last Name:* ${lastName}\n` +
            `*Language Code:* ${languageCode}`;

        return {
            type: "text",
            text,
            options: { parse_mode: "Markdown" }
        };
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

        console.log(`Callback query received: cmd=${cmd}, par1=${par1}, par2=${par2}, userId=${userId}, chatId=${chatId}`);

        try {
            let response, keyboard;

            switch (cmd) {
                case 'main_menu':
                    response = "🔧 System Management Panel";
                    keyboard = await this.keyboardManager.getMainKeyboard();
                    break;

                case 'system_status':
                    const statusResult = await this.systemHandler.handleSystemStatus({message: {from: {id: userId}}});
                    response = statusResult.text;
                    keyboard = await this.keyboardManager.getBackKeyboard();
                    break;

                case 'plugin_management':
                    const pluginResult = await this.pluginHandler.handleCallbackQuery(cmd, par1, par2, userId, chatId, message);
                    if (pluginResult) {
                        response = pluginResult.response;
                        keyboard = pluginResult.keyboard;
                    }
                    break;

                case 'cache_management':
                    const cacheResult = await this.cacheHandler.handleCallbackQuery(cmd, par1, par2, userId);
                    response = cacheResult.response;
                    keyboard = cacheResult.keyboard;
                    break;

                case 'health_check':
                    const healthResult = await this.healthHandler.handleHealthCheck({message: {from: {id: userId}}});
                    response = healthResult.text;
                    keyboard = await this.keyboardManager.getBackKeyboard();
                    break;

                case 'marketplace':
                    // Check if marketplace is enabled
                    if (!this.pm.config.USE_PLUGIN_MARKETPLACE) {
                        await this.bot.answerCallbackQuery(message.id, {
                            text: "❌ Plugin marketplace is disabled",
                            show_alert: true
                        });
                        return;
                    }
                    const marketResult = await this.marketplaceHandler.handleCallbackQuery(cmd, par1, par2, userId, chatId, message);
                    if (marketResult) {
                        response = marketResult.response;
                        keyboard = marketResult.keyboard;
                    }
                    break;

                default:
                    response = "❌ Unknown command";
                    keyboard = await this.keyboardManager.getMainKeyboard();
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
}
