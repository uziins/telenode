import { globalCache } from "../../helpers/cache.js";

export default class CacheHandler {
    constructor(masterPlugin) {
        this.masterPlugin = masterPlugin;
        this.auth = masterPlugin.auth;
        this.log = masterPlugin.log;
    }

    async handleCacheStats({message}) {
        const cacheStats = globalCache.getStats();
        const authStats = this.auth.getStats();

        let text = `🗃 *Cache Statistics*\n\n`;

        // Global Cache Statistics
        text += `🎯 Hit Rate: ${cacheStats.hitRate || 'N/A'}%\n`;
        text += `📦 Size: ${cacheStats.size || 0}/${cacheStats.maxSize || 'N/A'}\n`;
        text += `💾 Memory: ${cacheStats.memoryUsage || 'N/A'}\n`;
        text += `📈 Hits: ${cacheStats.hits || 0}\n`;
        text += `📉 Misses: ${cacheStats.misses || 0}\n`;
        text += `🗑️ Evictions: ${cacheStats.evictions || 0}\n\n`;

        // Auth Cache Statistics (updated structure)
        text += `🔐 *Auth Cache*\n`;
        text += `📦 Size: ${authStats.cache.size}/${authStats.cache.maxSize}\n`;
        text += `🎯 Hit Rate: ${authStats.cache.hitRate}%\n`;
        text += `📈 Hits: ${authStats.cache.hits}\n`;
        text += `📉 Misses: ${authStats.cache.misses}\n`;
        text += `🧹 Cleanups: ${authStats.cache.totalCleanups}\n`;
        text += `⏱️ Timeout: ${Math.round(authStats.cache.timeoutMs / 1000)}s\n\n`;

        // Authorization Statistics
        text += `👥 *Authorization*\n`;
        text += `🔑 Admins: ${authStats.authorization.adminCount}\n`;
        text += `👑 Root Users: ${authStats.authorization.rootUsersCount}\n`;
        text += `🔍 Total Checks: ${authStats.authorization.totalAuthChecks}\n`;
        text += `🚫 Blocked: ${authStats.authorization.blockedAttempts}\n`;
        text += `📊 Block Rate: ${authStats.authorization.blockRate}%\n\n`;

        // Performance Metrics
        text += `⚡ *Performance*\n`;
        text += `⏰ Uptime: ${authStats.performance.uptime.hours}h ${authStats.performance.uptime.minutes % 60}m\n`;
        text += `🚀 Avg Response: ${authStats.performance.avgResponseTime}ms\n`;
        text += `💾 Memory Used: ${authStats.system.memoryUsage.heapUsed}MB\n`;
        text += `💿 Total Memory: ${authStats.system.memoryUsage.heapTotal}MB\n\n`;

        // Database Status
        text += `🗄️ *Database*\n`;
        text += `🔗 Connections: ${authStats.database.connectionCount}\n`;
        authStats.database.connections.forEach(conn => {
            const statusIcon = conn.status === 'active' ? '✅' : conn.status === 'error' ? '❌' : '⚠️';
            text += `${statusIcon} ${conn.type}: ${conn.status}\n`;
        });

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
