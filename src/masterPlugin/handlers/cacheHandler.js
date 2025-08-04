import { globalCache } from "../../helpers/cache.js";

export default class CacheHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.log = masterPlugin.log;
    }

    async handleCacheStats({message}) {
        if (!this.auth.isRoot(message.from.id)) {
            this.log.warn(`Unauthorized access attempt by user ${message.from.id} to cache stats`);
            return;
        }

        // only process private messages
        if (message.chat.type !== 'private') {
            this.log.warn(`Cache stats can only be accessed in private messages`);
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

    async handleCallbackQuery(cmd, par1, par2, userId) {
        if (par1 === 'clear_cache') {
            globalCache.clear();
            const response = "✅ Cache cleared successfully";
            const keyboard = await this.masterPlugin.keyboardManager.getCacheKeyboard();
            return { response, keyboard };
        }

        const statsResult = await this.handleCacheStats({message: {from: {id: userId}}});
        const response = statsResult.text;
        const keyboard = await this.masterPlugin.keyboardManager.getCacheKeyboard();
        return { response, keyboard };
    }
}
