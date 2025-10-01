import PluginModel from "../../models/plugins.js";

const PluginTbl = new PluginModel();

export default class PluginHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.pm = masterPlugin.pm;
        this.log = masterPlugin.log;
        this.marketplace = masterPlugin.marketplace;
        this.config = masterPlugin.pm.config;
    }

    async handlePluginList({message}) {
        // only process private messages
        if (message.chat.type !== 'private') {
            this.log.warn(`Plugin list can only be accessed in private messages`);
            return;
        }
        // check if user is root
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

    async handlePluginCommand({message, args}) {
        // check if user is root
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to plugin reload`);
            return;
        }

        // only process private messages
        if (message.chat.type !== 'private') {
            this.log.warn(`Plugin reload can only be accessed in private messages`);
            return;
        }

        switch (args[0]) {
            case 'reload':
                if (args.length === 1) {
                    // Reload all plugins
                    try {
                        await this.pm.reloadPlugins();
                        return "✅ All plugins reloaded successfully.";
                    } catch (error) {
                        return `❌ Failed to reload plugins: ${error.message}`;
                    }
                } else {
                    // Reload specific plugin
                    const pluginName = args[1];
                    try {
                        await this.pm.unloadPlugin(pluginName);
                        await this.pm.loadSinglePlugin(pluginName);
                        return `✅ Plugin "${pluginName}" reloaded successfully.`;
                    } catch (error) {
                        return `❌ Failed to reload plugin "${pluginName}": ${error.message}`;
                    }
                }
            case 'i':
            case 'install':
                if (!this.config.USE_PLUGIN_MARKETPLACE) {
                    return "❌ Plugin marketplace is disabled. Install functionality is not available.";
                }
                if (args.length < 2) {
                    return "❌ Please provide a plugin identifier to install.";
                }
                const pluginIdentifier = args[1];
                const botData = await this.masterPlugin.bot.getMe();
                const detailsResult = await this.marketplace.getMarketplacePluginDownloadUrl(pluginIdentifier, botData.id);
                if (!detailsResult.success) {
                    return `❌ ${detailsResult.message}`;
                }
                const pData = detailsResult.data;
                let response = '';
                if (detailsResult.success) {
                    response = `⚠️ Are you sure you want to install plugin "${pData.name}"?\n\n` +
                        `📝 Description: ${pData.description}\n` +
                        `👤 Author: ${pData.author}\n` +
                        `🏷️ Version: ${pData.current_version}`;
                } else {
                    response = `⚠️ Are you sure you want to install this plugin?`;
                }

                let keyboard = [
                    [
                        { text: "📥 Yes, Install", callback_data: `marketplace install ${pluginIdentifier}|${pData.download_code}` },
                        { text: "❌ Cancel", callback_data: `marketplace detail ${pluginIdentifier}` }
                    ]
                ];

                return {
                    type: "text",
                    text: response,
                    options: {
                        parse_mode: "Markdown",
                        reply_markup: {
                            inline_keyboard: keyboard
                        }
                    }
                };
            case 'enable':
                if (args.length < 2) {
                    return "❌ Please provide a plugin identifier to enable.";
                }
                const enablePluginName = args[1];
                try {
                    await this.pm.activatePlugin(enablePluginName);
                    return `✅ Plugin "${enablePluginName}" has been enabled.`;
                } catch (error) {
                    return `❌ Failed to enable plugin "${enablePluginName}": ${error.message}`;
                }
            case 'disable':
                if (args.length < 2) {
                    return "❌ Please provide a plugin identifier to disable.";
                }
                const disablePluginName = args[1];
                try {
                    await this.pm.deactivatePlugin(disablePluginName);
                    return `✅ Plugin "${disablePluginName}" has been disabled.`;
                } catch (error) {
                    return `❌ Failed to disable plugin "${disablePluginName}": ${error.message}`;
                }
        }
    }

    async handleCallbackQuery(cmd, par1, par2, userId, chatId, message) {
        let response = "🔌 Plugin Management";
        let keyboard;

        if (par1 === 'detail') {
            const pluginName = par2;
            const pluginInfo = this.pm.getPluginInfo(pluginName);
            if (pluginInfo) {
                response = `🔧 Plugin: ${pluginInfo.name}\nDescription: ${pluginInfo.description}\nVersion: ${pluginInfo.version}\nAuthor: ${pluginInfo.author}`;
            } else {
                response = `❌ Plugin "${pluginName}" not found`;
            }
            keyboard = await this.masterPlugin.keyboardManager.getPluginDetailKeyboard(pluginName);
        } else if (par1 === 'confirm_update') {
            // Check if marketplace is enabled for update operations
            if (!this.config.USE_PLUGIN_MARKETPLACE) {
                response = "❌ Plugin marketplace is disabled. Update functionality is not available.";
                keyboard = await this.masterPlugin.keyboardManager.getPluginDetailKeyboard(par2);
                return { response, keyboard };
            }

            const pluginName = par2;
            const marketplacePlugin = await this.getPluginDetailInMarketplace(pluginName);
            const detail = await PluginTbl.upsertPlugin(pluginName);

            let updateText = "reinstall";
            if (marketplacePlugin && marketplacePlugin.current_version !== detail.version) {
                updateText = `update to version ${marketplacePlugin.current_version}`;
            }

            response = `⚠️ Are you sure you want to ${updateText} plugin "${pluginName}"?\n\nThis action will temporarily stop the plugin and may affect its current state.`;
            keyboard = [
                [
                    { text: "✅ Yes, Continue", callback_data: `plugin_management update ${pluginName}` },
                    { text: "❌ Cancel", callback_data: `plugin_management detail ${pluginName}` }
                ]
            ];
        } else if (par1 === 'confirm_uninstall') {
            // Check if marketplace is enabled for uninstall operations
            if (!this.config.USE_PLUGIN_MARKETPLACE) {
                response = "❌ Plugin marketplace is disabled. Uninstall functionality is not available.";
                keyboard = await this.masterPlugin.keyboardManager.getPluginDetailKeyboard(par2);
                return { response, keyboard };
            }

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
            keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
        } else if (par1 === 'update') {
            return await this.handlePluginUpdate(par2, chatId, message);
        } else if (par1 === 'uninstall') {
            return await this.handlePluginUninstall(par2, chatId, message);
        } else if (par1 === 'reload_all_plugins') {
            // Check if user is root
            if (!this.auth.isRoot(userId)) {
                response = "❌ You do not have permission to reload all plugins.";
                keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
            } else {
                try {
                    await this.pm.reloadPlugins();
                    response = "✅ All plugins reloaded successfully.";
                } catch (error) {
                    response = `❌ Failed to reload plugins: ${error.message}`;
                }
                keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
            }
        } else {
            keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
        }

        return { response, keyboard };
    }

    async handlePluginUpdate(pluginName, chatId, message) {
        // Check if marketplace is enabled
        if (!this.config.USE_PLUGIN_MARKETPLACE) {
            const response = "❌ Plugin marketplace is disabled. Update functionality is not available.";
            const keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
            return { response, keyboard };
        }

        let response = "⏳ Updating plugin...";

        // Send immediate response
        await this.masterPlugin.bot.editMessageText(response, {
            chat_id: chatId,
            message_id: message.message.message_id,
            parse_mode: "Markdown"
        });

        try {
            // First, try to get plugin details from marketplace
            const botData = await this.masterPlugin.bot.getMe();
            const detailsResult = await this.marketplace.getMarketplacePluginDownloadUrl(pluginName, botData.id)
            if (detailsResult.success) {
                // Uninstall current version first
                const uninstallResult = await this.marketplace.uninstallPlugin(pluginName);
                if (uninstallResult.success) {
                    // Install the latest version
                    const installResult = await this.marketplace.installPlugin(pluginName, detailsResult.data.download_uuid);
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

        const keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
        return { response, keyboard };
    }

    async handlePluginUninstall(pluginName, chatId, message) {
        // Check if marketplace is enabled
        if (!this.config.USE_PLUGIN_MARKETPLACE) {
            const response = "❌ Plugin marketplace is disabled. Uninstall functionality is not available.";
            const keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
            return { response, keyboard };
        }

        let response = "⏳ Uninstalling plugin...";

        // Send immediate response
        await this.masterPlugin.bot.editMessageText(response, {
            chat_id: chatId,
            message_id: message.message.message_id,
            parse_mode: "Markdown"
        });

        try {
            // disable the plugin first
            await this.pm.deactivatePlugin(pluginName);
            // Now uninstall the plugin
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

        const keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
        return { response, keyboard };
    }

    async getPluginDetailInMarketplace(pluginName) {
        // Return null if marketplace is disabled
        if (!this.config.USE_PLUGIN_MARKETPLACE) {
            return null;
        }

        const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginName);
        return detailsResult.success ? detailsResult.data : null;
    }
}
