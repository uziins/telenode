import Plugin from "../../plugin.js";

export default class HelpHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.pm = masterPlugin.pm;
        this.log = masterPlugin.log;
    }

    async handleGlobalHelp({message}) {
        const userId = message.from.id;
        const chatId = message.chat.id;

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
                canAccess = this.auth.isAdmin(userId, chatId) || this.auth.isRoot(userId);
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

            if (adminPlugins.length > 0 && (this.auth.isAdmin(userId, chatId) || this.auth.isRoot(userId))) {
                helpText += `🛡️ *Admin Help:*\n`;
                for (const plugin of adminPlugins) {
                    helpText += `🔹 *${plugin.name}*\n${plugin.help}\n\n`;
                }
            }

            if (((rootPlugins.length > 0 && this.auth.isRoot(userId)) || this.auth.isRoot(userId)) && message.chat?.type === 'private') {
                helpText += `👑 *Root Help:*\n`;
                // add master plugin help
                helpText += `🔹 *${this.masterPlugin.plugin.name}*\n${this.masterPlugin.plugin.help}\n\n`;
                for (const plugin of rootPlugins) {
                    helpText += `🔹 *${plugin.name}*\n${plugin.help}\n\n`;
                }
            }
        } else {
            if (this.auth.isRoot(userId) && message.chat?.type === 'private') {
                helpText += `👑 *Root Help:*\n`;
                helpText += `🔹 *${this.masterPlugin.plugin.name}*\n${this.masterPlugin.plugin.help}\n\n`;
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
}
