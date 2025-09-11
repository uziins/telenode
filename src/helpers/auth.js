import config from "../config.js"
import Authorizations from "../models/authorizations.js";
import Users from "../models/users.js";
import Chats from "../models/chats.js";
import Logger from "../logger.js";

const Chat = new Chats();
const User = new Users();
const log = Logger(config.APP_NAME, 'auth', config.LOG_LEVEL);

export default class Auth {
    constructor() {
        this.authorizations = new Authorizations();
        this.root = config.BOT_SUDOERS;
        this.admin = [];

        // Caching system
        this.cache = new Map();
        this.cacheTimeout = ((config.cache?.ttl ?? 60) * 1000); // Default to 60 seconds if undefined
        this.maxCacheSize = config.cache?.maxSize ?? 1000; // Default to 1000 if undefined

        // Store database connections for cleanup
        this.dbConnections = [this.authorizations, Chat, User];

        // Performance metrics
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0,
            authChecks: 0,
            blockedAttempts: 0,
            lastCleanup: null,
            initTime: Date.now(),
            totalCacheCleanups: 0,
            avgResponseTime: 0,
            responseTimes: []
        };

        // Cleanup interval for cache
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, this.cacheTimeout);

        this.init().then(() => {
            log.debug("Auth initialized");
        }).catch(error => {
            log.error("Auth initialization failed:", error);
        });
    }

    async init() {
        try {
            const admin = await this.authorizations
                .select("user_id", "chat_id")
                .where("role", "admin")
                .get();

            this.admin = admin.map(a => ({
                user_id: a.user_id,
                chat_id: a.chat_id
            }));

            log.info(`Loaded ${this.admin.length} admin authorizations`);
        } catch (error) {
            log.error("Failed to load admin authorizations:", error);
            throw error;
        }
    }

    cleanupCache() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, data] of this.cache.entries()) {
            if (now - data.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        // If cache is still too large, remove oldest entries
        if (this.cache.size > this.maxCacheSize) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toRemove = this.cache.size - this.maxCacheSize;
            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.metrics.totalCacheCleanups++;
            this.metrics.lastCleanup = new Date();
            log.debug(`Cleaned up ${cleanedCount} cache entries`);
        }
    }

    getCacheKey(type, id, chatId = null) {
        return chatId ? `${type}:${id}:${chatId}` : `${type}:${id}`;
    }

    getFromCache(key) {
        const data = this.cache.get(key);
        if (!data) {
            this.metrics.cacheMisses++;
            return null;
        }

        if (Date.now() - data.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            this.metrics.cacheMisses++;
            return null;
        }

        this.metrics.cacheHits++;
        return data.value;
    }

    setCache(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    async addAdmin(user_id, chat_id) {
        try {
            // Validate inputs
            if (!user_id || !chat_id) {
                throw new Error('user_id and chat_id are required');
            }

            // Check if user is already admin
            if (this.isAdmin(user_id, chat_id)) {
                log.warn(`User ${user_id} is already admin in chat ${chat_id}`);
                return { success: false, message: 'User is already admin' };
            }

            // Check if user exists and is not blocked
            const userRecord = await User.where("id", user_id).first();
            if (userRecord && userRecord.is_blocked) {
                throw new Error('Cannot add blocked user as admin');
            }

            if (await this.authorizations.addAdmin(user_id, chat_id)) {
                if (!this.admin.some(a => a.user_id === user_id && a.chat_id === chat_id)) {
                    this.admin.push({user_id, chat_id});
                }

                // Clear relevant cache entries
                this.clearUserCache(user_id, chat_id);

                log.info(`Added admin: user_id=${user_id}, chat_id=${chat_id}`);
                return { success: true, message: 'Admin added successfully' };
            }
            return { success: false, message: 'Failed to add admin to database' };
        } catch (error) {
            log.error(`Failed to add admin:`, error);
            return { success: false, error: error.message };
        }
    }

    async removeAdmin(user_id, chat_id) {
        try {
            // Validate inputs
            if (!user_id || !chat_id) {
                throw new Error('user_id and chat_id are required');
            }

            // Check if user is admin
            if (!this.isAdmin(user_id, chat_id)) {
                log.warn(`User ${user_id} is not admin in chat ${chat_id}`);
                return { success: false, message: 'User is not admin' };
            }

            if (await this.authorizations.removeAdmin(user_id, chat_id)) {
                this.admin = this.admin.filter(a =>
                    !(a.user_id === user_id && a.chat_id === chat_id)
                );

                // Clear relevant cache entries
                this.clearUserCache(user_id, chat_id);

                log.info(`Removed admin: user_id=${user_id}, chat_id=${chat_id}`);
                return { success: true, message: 'Admin removed successfully' };
            }
            return { success: false, message: 'Failed to remove admin from database' };
        } catch (error) {
            log.error(`Failed to remove admin:`, error);
            return { success: false, error: error.message };
        }
    }

    clearUserCache(user_id, chat_id = null) {
        const patterns = [
            `user:${user_id}`,
            `chat:${chat_id}`,
            `granted:${user_id}:${chat_id}`
        ];

        for (const [key] of this.cache.entries()) {
            if (patterns.some(pattern => key.includes(pattern))) {
                this.cache.delete(key);
            }
        }
    }

    async isGranted(message) {
        const startTime = Date.now();
        this.metrics.authChecks++;

        const {from, chat} = message.message || message;

        if (!from || !chat) {
            log.warn('Invalid message format for authorization check');
            return false;
        }

        // ROOT users always have access - bypass all checks
        if (this.isRoot(from.id)) {
            log.debug(`ROOT user ${from.id} granted access (bypassed all checks)`);
            return true;
        }

        const cacheKey = this.getCacheKey('granted', from.id, chat.id);
        const cached = this.getFromCache(cacheKey);

        if (cached !== null) {
            return cached;
        }

        try {
            let granted = true;

            // Check chat permissions
            const chatGranted = await this.checkChatPermissions(chat);
            if (!chatGranted) {
                granted = false;
                this.metrics.blockedAttempts++;
            }

            // Check user permissions (only if chat is allowed)
            if (granted) {
                const userGranted = await this.checkUserPermissions(from);
                if (!userGranted) {
                    granted = false;
                    this.metrics.blockedAttempts++;
                }
            }

            // Check if user is banned from this specific chat
            if (granted) {
                const isBanned = await this.isUserBannedFromChat(from.id, chat.id);
                if (isBanned) {
                    granted = false;
                    this.metrics.blockedAttempts++;
                    log.debug(`User ${from.id} is banned from chat ${chat.id}`);
                }
            }

            // Cache the result
            this.setCache(cacheKey, granted);

            // Track response time
            const responseTime = Date.now() - startTime;
            this.updateResponseTime(responseTime);

            return granted;

        } catch (error) {
            log.error('Error checking permissions:', error);
            return false;
        }
    }

    updateResponseTime(responseTime) {
        this.metrics.responseTimes.push(responseTime);

        // Keep only last 100 response times for moving average
        if (this.metrics.responseTimes.length > 100) {
            this.metrics.responseTimes.shift();
        }

        // Calculate average response time
        this.metrics.avgResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    }

    async checkChatPermissions(chat) {
        const cacheKey = this.getCacheKey('chat', chat.id);
        const cached = this.getFromCache(cacheKey);

        if (cached !== null) {
            return cached;
        }

        try {
            let chatRecord = await Chat.where("id", chat.id).first();

            if (chatRecord) {
                const isAllowed = !chatRecord.is_blocked;
                this.setCache(cacheKey, isAllowed);
                return isAllowed;
            } else {
                // Insert new chat record
                await Chat.insertIgnore(chat);
                this.setCache(cacheKey, true);
                return true;
            }
        } catch (error) {
            log.error('Error checking chat permissions:', error);
            return false;
        }
    }

    async checkUserPermissions(from) {
        const cacheKey = this.getCacheKey('user', from.id);
        const cached = this.getFromCache(cacheKey);

        if (cached !== null) {
            return cached;
        }

        try {
            let userRecord = await User.where("id", from.id).first();

            if (userRecord) {
                const isAllowed = !userRecord.is_blocked;
                this.setCache(cacheKey, isAllowed);
                return isAllowed;
            } else {
                // Insert new user record
                await User.insertIgnore(from);
                this.setCache(cacheKey, true);
                return true;
            }
        } catch (error) {
            log.error('Error checking user permissions:', error);
            return false;
        }
    }

    isRoot(user_id) {
        if (!user_id) return false;
        return this.root.includes(user_id);
    }

    isAdmin(user_id, chat_id) {
        if (!user_id || !chat_id) return false;
        return this.admin.some(a => a.user_id === user_id && a.chat_id === chat_id);
    }

    // Enhanced permission checking methods
    async hasPermission(user_id, chat_id, permission) {
        if (this.isRoot(user_id)) return true;
        if (this.isAdmin(user_id, chat_id)) return true;

        // TODO: Add more granular permission checking here if needed
        return false;
    }

    async blockUser(user_id) {
        try {
            // Validate inputs
            if (!user_id) {
                throw new Error('user_id is required');
            }

            // Prevent blocking root users
            if (this.isRoot(user_id)) {
                throw new Error('Cannot block root user');
            }

            // Check if user is already blocked
            const userRecord = await User.where("id", user_id).first();
            if (userRecord && userRecord.is_blocked) {
                return { success: false, message: 'User is already blocked' };
            }

            await User.where("id", user_id).update({
                is_blocked: true,
            });

            this.clearUserCache(user_id);
            log.info(`Blocked user ${user_id}.`);
            return { success: true, message: 'User blocked successfully' };
        } catch (error) {
            log.error(`Failed to block user ${user_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async unblockUser(user_id) {
        try {
            // Validate inputs
            if (!user_id) {
                throw new Error('user_id is required');
            }

            // Check if user is actually blocked
            const userRecord = await User.where("id", user_id).first();
            if (!userRecord || !userRecord.is_blocked) {
                return { success: false, message: 'User is not blocked' };
            }

            await User.where("id", user_id).update({
                is_blocked: false
            });

            this.clearUserCache(user_id);
            log.info(`Unblocked user ${user_id}.`);
            return { success: true, message: 'User unblocked successfully' };
        } catch (error) {
            log.error(`Failed to unblock user ${user_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    // ban user in a specific chat
    async banUser(user_id, chat_id, reason = null, banned_by = null) {
        try {
            // Validate inputs
            if (!user_id || !chat_id) {
                throw new Error('user_id and chat_id are required');
            }

            // Prevent banning root users
            if (this.isRoot(user_id)) {
                throw new Error('Cannot ban root user from chat');
            }

            // Check if user is already banned in this chat
            const banRecord = await this.authorizations
                .where("user_id", user_id)
                .where("chat_id", chat_id)
                .where("role", "banned")
                .first();

            if (banRecord) {
                return { success: false, message: 'User is already banned from this chat' };
            }

            // Add ban record to authorizations table
            await this.authorizations.insertOrUpdate({
                user_id: user_id,
                chat_id: chat_id,
                role: "banned",
                granted_by: banned_by,
                granted_at: new Date(),
                note: reason
            });

            // Clear relevant cache entries
            this.clearUserCache(user_id, chat_id);

            log.info(`Banned user ${user_id} from chat ${chat_id}. Reason: ${reason || 'No reason provided'}. Banned by: ${banned_by || 'System'}`);
            return { success: true, message: 'User banned from chat successfully' };
        } catch (error) {
            log.error(`Failed to ban user ${user_id} from chat ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async unbanUser(user_id, chat_id, unbanned_by = null) {
        try {
            // Validate inputs
            if (!user_id || !chat_id) {
                throw new Error('user_id and chat_id are required');
            }

            // Check if user is actually banned in this chat
            const banRecord = await this.authorizations
                .where("user_id", user_id)
                .where("chat_id", chat_id)
                .where("role", "banned")
                .first();

            if (!banRecord) {
                return { success: false, message: 'User is not banned from this chat' };
            }

            // Remove ban record from authorizations table
            await this.authorizations
                .where("user_id", user_id)
                .where("chat_id", chat_id)
                .where("role", "banned")
                .delete();

            // Clear relevant cache entries
            this.clearUserCache(user_id, chat_id);

            log.info(`Unbanned user ${user_id} from chat ${chat_id}. Unbanned by: ${unbanned_by || 'System'}`);
            return { success: true, message: 'User unbanned from chat successfully' };
        } catch (error) {
            log.error(`Failed to unban user ${user_id} from chat ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Check if user is banned from specific chat
    async isUserBannedFromChat(user_id, chat_id) {
        try {
            const banRecord = await this.authorizations
                .where("user_id", user_id)
                .where("chat_id", chat_id)
                .where("role", "banned")
                .first();

            return banRecord !== null;
        } catch (error) {
            log.error(`Failed to check ban status for user ${user_id} in chat ${chat_id}:`, error);
            return false;
        }
    }

    // Get list of banned users in a chat
    async getBannedUsersInChat(chat_id) {
        try {
            const bannedUsers = await this.authorizations
                .select("user_id", "granted_by", "granted_at", "note")
                .where("chat_id", chat_id)
                .where("role", "banned")
                .get();

            return {
                success: true,
                data: bannedUsers
            };
        } catch (error) {
            log.error(`Failed to get banned users for chat ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Get list of chats where user is banned
    async getUserBannedChats(user_id) {
        try {
            const bannedChats = await this.authorizations
                .select("chat_id", "granted_by", "granted_at", "note")
                .where("user_id", user_id)
                .where("role", "banned")
                .get();

            return {
                success: true,
                data: bannedChats
            };
        } catch (error) {
            log.error(`Failed to get banned chats for user ${user_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async blockChat(chat_id) {
        try {
            // Validate inputs
            if (!chat_id) {
                throw new Error('chat_id is required');
            }

            // Check if chat is already blocked
            const chatRecord = await Chat.where("id", chat_id).first();
            if (chatRecord && chatRecord.is_blocked) {
                return { success: false, message: 'Chat is already blocked' };
            }

            await Chat.where("id", chat_id).update({
                is_blocked: true,
            });

            this.clearUserCache(null, chat_id);
            log.info(`Blocked chat ${chat_id}.`);
            return { success: true, message: 'Chat blocked successfully' };
        } catch (error) {
            log.error(`Failed to block chat ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async unblockChat(chat_id) {
        try {
            // Validate inputs
            if (!chat_id) {
                throw new Error('chat_id is required');
            }

            // Check if chat is actually blocked
            const chatRecord = await Chat.where("id", chat_id).first();
            if (!chatRecord || !chatRecord.is_blocked) {
                return { success: false, message: 'Chat is not blocked' };
            }

            await Chat.where("id", chat_id).update({
                is_blocked: false,
            });

            this.clearUserCache(null, chat_id);
            log.info(`Unblocked chat ${chat_id}. Unblocked by: ${unblocked_by || 'System'}`);
            return { success: true, message: 'Chat unblocked successfully' };
        } catch (error) {
            log.error(`Failed to unblock chat ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    async getUserInfo(user_id) {
        try {
            const userRecord = await User.where("id", user_id).first();
            if (!userRecord) {
                return { success: false, message: 'User not found' };
            }

            return {
                success: true,
                data: {
                    id: userRecord.id,
                    username: userRecord.username,
                    first_name: userRecord.first_name,
                    last_name: userRecord.last_name,
                    is_blocked: userRecord.is_blocked,
                    is_bot: userRecord.is_bot,
                    is_root: this.isRoot(user_id),
                    admin_chats: this.admin.filter(a => a.user_id === user_id).map(a => a.chat_id)
                }
            };
        } catch (error) {
            log.error(`Failed to get user info for ${user_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    // New method to get chat info with blocking status
    async getChatInfo(chat_id) {
        try {
            const chatRecord = await Chat.where("id", chat_id).first();
            if (!chatRecord) {
                return { success: false, message: 'Chat not found' };
            }

            return {
                success: true,
                data: {
                    id: chatRecord.id,
                    title: chatRecord.title,
                    type: chatRecord.type,
                    is_blocked: chatRecord.is_blocked,
                    blocked_reason: chatRecord.blocked_reason,
                    blocked_at: chatRecord.blocked_at,
                    blocked_by: chatRecord.blocked_by,
                    admins: this.admin.filter(a => a.chat_id === chat_id).map(a => a.user_id)
                }
            };
        } catch (error) {
            log.error(`Failed to get chat info for ${chat_id}:`, error);
            return { success: false, error: error.message };
        }
    }

    // New method to list all admins
    async listAdmins(chat_id = null) {
        try {
            if (chat_id) {
                return {
                    success: true,
                    data: this.admin.filter(a => a.chat_id === chat_id)
                };
            }
            return {
                success: true,
                data: this.admin
            };
        } catch (error) {
            log.error('Failed to list admins:', error);
            return { success: false, error: error.message };
        }
    }

    // Enhanced Statistics and monitoring
    getStats() {
        const uptime = Date.now() - this.metrics.initTime;
        const cacheUtilization = (this.cache.size / this.maxCacheSize) * 100;

        return {
            // Cache statistics
            cache: {
                size: this.cache.size,
                maxSize: this.maxCacheSize,
                utilization: Math.round(cacheUtilization * 100) / 100,
                hitRate: this.getCacheHitRate(),
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                totalCleanups: this.metrics.totalCacheCleanups,
                lastCleanup: this.metrics.lastCleanup,
                timeoutMs: this.cacheTimeout
            },

            // Authorization statistics
            authorization: {
                adminCount: this.admin.length,
                rootUsersCount: this.root.length,
                totalAuthChecks: this.metrics.authChecks,
                blockedAttempts: this.metrics.blockedAttempts,
                blockRate: this.metrics.authChecks > 0 ?
                    Math.round((this.metrics.blockedAttempts / this.metrics.authChecks) * 10000) / 100 : 0
            },

            // Performance metrics
            performance: {
                uptime: {
                    ms: uptime,
                    seconds: Math.round(uptime / 1000),
                    minutes: Math.round(uptime / 60000),
                    hours: Math.round(uptime / 3600000)
                },
                avgResponseTime: Math.round(this.metrics.avgResponseTime * 100) / 100,
                recentResponseTimes: this.metrics.responseTimes.slice(-10),
                totalQueries: this.metrics.totalQueries
            },

            // Database connections
            database: {
                connectionCount: this.dbConnections.length,
                connections: this.dbConnections.map(conn => ({
                    type: conn.constructor.name,
                    status: this.getConnectionStatus(conn)
                }))
            },

            // Memory and system info
            system: {
                memoryUsage: this.getMemoryUsage(),
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };
    }

    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        if (total === 0) return 0;
        return Math.round((this.metrics.cacheHits / total) * 10000) / 100;
    }

    getConnectionStatus(connection) {
        try {
            // Check if connection has a status or state property
            if (connection.connection) {
                if (connection.connection.state) {
                    return connection.connection.state;
                }
                if (connection.connection.readyState !== undefined) {
                    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
                    return states[connection.connection.readyState] || 'unknown';
                }
            }
            return 'active';
        } catch (error) {
            return 'error';
        }
    }

    getMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            return {
                rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
                external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
                arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024 * 100) / 100 // MB
            };
        } catch (error) {
            return { error: 'Unable to get memory usage' };
        }
    }

    // Additional utility methods for monitoring
    getDetailedCacheStats() {
        const entries = Array.from(this.cache.entries());
        const now = Date.now();

        const cacheTypes = {};
        let oldestEntry = now;
        let newestEntry = 0;

        entries.forEach(([key, data]) => {
            const type = key.split(':')[0];
            if (!cacheTypes[type]) {
                cacheTypes[type] = { count: 0, totalAge: 0 };
            }
            cacheTypes[type].count++;
            cacheTypes[type].totalAge += (now - data.timestamp);

            if (data.timestamp < oldestEntry) oldestEntry = data.timestamp;
            if (data.timestamp > newestEntry) newestEntry = data.timestamp;
        });

        // Calculate average age per type
        Object.keys(cacheTypes).forEach(type => {
            cacheTypes[type].avgAge = Math.round(cacheTypes[type].totalAge / cacheTypes[type].count);
        });

        return {
            totalEntries: entries.length,
            oldestEntryAge: oldestEntry === now ? 0 : now - oldestEntry,
            newestEntryAge: newestEntry === 0 ? 0 : now - newestEntry,
            typeBreakdown: cacheTypes
        };
    }

    resetMetrics() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0,
            authChecks: 0,
            blockedAttempts: 0,
            lastCleanup: null,
            initTime: Date.now(),
            totalCacheCleanups: 0,
            avgResponseTime: 0,
            responseTimes: []
        };
        log.info('Auth metrics reset');
    }

    // Enhanced cleanup method to fix Jest teardown issue
    async destroy() {
        // Clear the cache cleanup interval
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }

        // Clear the cache
        this.cache.clear();

        // Close database connections if they have a close method
        for (const connection of this.dbConnections || []) {
            if (connection && typeof connection.close === 'function') {
                try {
                    await connection.close();
                } catch (error) {
                    log.debug('Error closing database connection:', error);
                }
            }
            // For letsql models, try to close the underlying connection
            if (connection && connection.connection && typeof connection.connection.end === 'function') {
                try {
                    await connection.connection.end();
                } catch (error) {
                    log.debug('Error closing underlying database connection:', error);
                }
            }
        }

        // Clear references
        this.dbConnections = [];
        this.admin = [];

        log.debug('Auth helper destroyed and cleaned up');
    }
}
