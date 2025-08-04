export default class MarketplaceHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.pm = masterPlugin.pm;
        this.log = masterPlugin.log;
        this.marketplace = masterPlugin.marketplace;
    }

    async handleMarketplace({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to marketplace`);
            return;
        }

        const marketplaceResult = await this.marketplace.getMarketplacePlugins(1);

        let text;
        if (marketplaceResult.total > 0) {
            text = `🛒 *Plugin Marketplace*\n📄 Page ${marketplaceResult.page} of ${marketplaceResult.totalPages}`;
        } else {
            text = "🛒 Plugin Marketplace";
        }

        return {
            type: "text",
            text: text,
            options: {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: await this.masterPlugin.keyboardManager.getMarketplaceKeyboard(1)
                }
            }
        };
    }

    async handleCallbackQuery(cmd, par1, par2, userId, chatId, message) {
        let response = "🛒 Plugin Marketplace";
        let keyboard;

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
            keyboard = await this.masterPlugin.keyboardManager.getMarketplaceDetailKeyboard(pluginCode);
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
            keyboard = await this.masterPlugin.keyboardManager.getMarketplaceKeyboard(page);
        } else if (par1 === 'install') {
            return await this.handlePluginInstall(par2, chatId, message);
        } else if (par1 === 'uninstall') {
            return await this.handlePluginUninstall(par2, chatId, message);
        } else {
            const marketplaceResult = await this.marketplace.getMarketplacePlugins(1);

            if (marketplaceResult.total > 0) {
                response = `🛒 *Plugin Marketplace*\n📄 Page ${marketplaceResult.page} of ${marketplaceResult.totalPages}`;
            } else {
                response = "🛒 Plugin Marketplace";
            }
            keyboard = await this.masterPlugin.keyboardManager.getMarketplaceKeyboard(1);
        }

        return { response, keyboard };
    }

    async handlePluginInstall(pluginCode, chatId, message) {
        let response = "⏳ Installing plugin...";

        // Send immediate response
        await this.masterPlugin.bot.editMessageText(response, {
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

        const keyboard = await this.masterPlugin.keyboardManager.getMarketplaceKeyboard();
        return { response, keyboard };
    }

    async handlePluginUninstall(pluginName, chatId, message) {
        const uninstallResult = await this.marketplace.uninstallPlugin(pluginName);
        let response;

        if (uninstallResult.success) {
            response = `✅ Plugin "${pluginName}" uninstalled successfully!`;
            if (uninstallResult.needsReload) {
                response += "\n\n⚠️ Please reload plugins to complete removal.";
            }
        } else {
            response = `❌ Uninstall failed: ${uninstallResult.error}`;
        }

        const keyboard = await this.masterPlugin.keyboardManager.getPluginKeyboard();
        return { response, keyboard };
    }
}
