import PluginModel from "../models/plugins.js";

const PluginTbl = new PluginModel();

export default class KeyboardManager {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.marketplace = masterPlugin.marketplace;
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
        
        keyboard.push([
            { text: "🔄 Reload All", callback_data: "reload_all_plugins" },
            { text: "➕ Add Plugin", callback_data: "marketplace" }
        ]);
        
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
            let installText = `🔄 Reinstall`;
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

        if (marketplaceResult.plugins && marketplaceResult.plugins.length > 0) {
            for (let i = 0; i < marketplaceResult.plugins.length; i += btnPerRow) {
                let row = [];
                for (let j = 0; j < btnPerRow; j++) {
                    let plugin = marketplaceResult.plugins[i + j];
                    if (!plugin) break;
                    row.push({
                        text: plugin.name,
                        callback_data: `marketplace detail ${plugin.code}`
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
        const installedPlugins = await PluginTbl.get();
        const isInstalled = installedPlugins.some(p => p.identifier === pluginCode);

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
