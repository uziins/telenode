import PluginModel from "../models/plugins.js";

const PluginTbl = new PluginModel();

export default class KeyboardManager {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.marketplace = masterPlugin.marketplace;
        this.config = masterPlugin.pm.config;
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

    async getBackKeyboard() {
        return [
            [{ text: "🔙 Back", callback_data: "main_menu" }]
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
                row.push({
                    text: `${pl.name} ${status}`, 
                    callback_data: `plugin_management ${command} ${pl.identifier}`
                });
            }
            keyboard.push(row);
        }
        
        // Conditionally add marketplace button based on config
        if (this.config.USE_PLUGIN_MARKETPLACE) {
            keyboard.push([
                { text: "🔄 Reload All", callback_data: "plugin_management reload_all_plugins" },
                { text: "➕ Add Plugin", callback_data: "marketplace" }
            ]);
        } else {
            keyboard.push([
                { text: "🔄 Reload All", callback_data: "plugin_management reload_all_plugins" }
            ]);
        }

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

        let keyboard = [[actionButton]];

        // Only show marketplace-related buttons if marketplace is enabled
        if (this.config.USE_PLUGIN_MARKETPLACE) {
            // Check if plugin is available in marketplace for updates
            const marketplacePlugin = await this.getPluginDetailInMarketplace(pluginName);

            if (marketplacePlugin) {
                let installText = `🔄 Reinstall`;
                if (marketplacePlugin.current_version !== detail.version) {
                    installText = `🔄 Update to ${marketplacePlugin.current_version}`;
                }
                keyboard.push([
                    { text: installText, callback_data: `plugin_management confirm_update ${pluginName}` }
                ]);
            }

            keyboard.push([
                { text: "🗑️ Uninstall", callback_data: `plugin_management confirm_uninstall ${pluginName}` }
            ]);
        }

        keyboard.push([
            { text: "🔙 Back", callback_data: "plugin_management" }
        ]);

        return keyboard;
    }

    async getCacheKeyboard() {
        return [
            [
                { text: "🗑️ Clear Cache", callback_data: "cache_management clear_cache" }
            ],
            [
                { text: "🔙 Back", callback_data: "main_menu" }
            ]
        ];
    }

    async getMarketplaceKeyboard(page = 1) {
        const marketplaceResult = await this.marketplace.getMarketplacePlugins(page);
        const btnPerRow = 2;
        let keyboard = [];

        if (marketplaceResult.data && marketplaceResult.data.length > 0) {
            for (let i = 0; i < marketplaceResult.data.length; i += btnPerRow) {
                let row = [];
                for (let j = 0; j < btnPerRow; j++) {
                    let plugin = marketplaceResult.data[i + j];
                    if (!plugin) break;
                    row.push({
                        text: plugin.name,
                        callback_data: `marketplace detail ${plugin.slug}`
                    });
                }
                keyboard.push(row);
            }

            // Pagination buttons
            let paginationRow = [];
            if (page > 1) {
                paginationRow.push({
                    text: "⬅️ Previous",
                    callback_data: `marketplace page ${page - 1}`
                });
            }
            if (page < marketplaceResult.totalPages) {
                paginationRow.push({
                    text: "➡️ Next",
                    callback_data: `marketplace page ${page + 1}`
                });
            }
            if (paginationRow.length > 0) {
                keyboard.push(paginationRow);
            }
        }

        keyboard.push([
            { text: "🔙 Back to Plugins", callback_data: "plugin_management" }
        ]);

        return keyboard;
    }

    async getMarketplaceDetailKeyboard(pluginCode) {
        // Check if plugin is already installed
        const isInstalled = await PluginTbl.where('identifier', pluginCode).first();

        let keyboard = [];

        if (isInstalled) {
            keyboard.push([
                { text: "🔄 Reinstall", callback_data: `marketplace confirm_reinstall ${pluginCode}` },
                { text: "🗑️ Uninstall", callback_data: `marketplace confirm_uninstall_marketplace ${pluginCode}` }
            ]);
        } else {
            keyboard.push([
                { text: "📥 Install", callback_data: `marketplace confirm_install ${pluginCode}` }
            ]);
        }

        keyboard.push([
            { text: "🔙 Back", callback_data: "marketplace" }
        ]);

        return keyboard;
    }

    async getPluginDetailInMarketplace(pluginName) {
        const detailsResult = await this.marketplace.getMarketplacePluginDetails(pluginName);
        return detailsResult.success ? detailsResult.data : null;
    }
}
