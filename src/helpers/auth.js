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
        this.cacheTimeout = config.cache.ttl * 1000; // Convert to milliseconds
        this.maxCacheSize = config.cache.maxSize;

        // Store database connections for cleanup
        this.dbConnections = [this.authorizations, Chat, User];

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
            log.debug(`Cleaned up ${cleanedCount} cache entries`);
        }
    }

    getCacheKey(type, id, chatId = null) {
        return chatId ? `${type}:${id}:${chatId}` : `${type}:${id}`;
    }

    getFromCache(key) {
        const data = this.cache.get(key);
        if (!data) return null;

        if (Date.now() - data.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }

        return data.value;
    }

    setCache(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    async isGranted(message) {
        const {from, chat} = message.message || message;

        if (!from || !chat) {
            log.warn('Invalid message format for authorization check');
            return false;
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
            }

            // Check user permissions (only if chat is allowed)
            if (granted) {
                const userGranted = await this.checkUserPermissions(from);
                if (!userGranted) {
                    granted = false;
                }
            }

            // Cache the result
            this.setCache(cacheKey, granted);

            return granted;

        } catch (error) {
            log.error('Error checking permissions:', error);
            return false;
        }
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
