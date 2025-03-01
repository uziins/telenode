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

    async addAdmin(user_id, chat_id) {
        try {
            if (await this.authorizations.addAdmin(user_id, chat_id)) {
                if (!this.admin.some(a => a.user_id === user_id && a.chat_id === chat_id)) {
                    this.admin.push({user_id, chat_id});
                }

                // Clear relevant cache entries
                this.clearUserCache(user_id, chat_id);

                log.info(`Added admin: user_id=${user_id}, chat_id=${chat_id}`);
                return true;
            }
            return false;
        } catch (error) {
            log.error(`Failed to add admin:`, error);
            throw error;
        }
    }

    async removeAdmin(user_id, chat_id) {
        try {
            if (await this.authorizations.removeAdmin(user_id, chat_id)) {
                this.admin = this.admin.filter(a =>
                    !(a.user_id === user_id && a.chat_id === chat_id)
                );

                // Clear relevant cache entries
                this.clearUserCache(user_id, chat_id);

                log.info(`Removed admin: user_id=${user_id}, chat_id=${chat_id}`);
                return true;
            }
            return false;
        } catch (error) {
            log.error(`Failed to remove admin:`, error);
            throw error;
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

    // Enhanced permission checking methods
    async hasPermission(user_id, chat_id, permission) {
        if (this.isRoot(user_id)) return true;
        if (this.isAdmin(user_id, chat_id)) return true;

        // Add more granular permission checking here if needed
        return false;
    }

    async blockUser(user_id, reason = null) {
        try {
            await User.where("id", user_id).update({
                is_blocked: true,
                blocked_reason: reason,
                blocked_at: new Date()
            });

            this.clearUserCache(user_id);
            log.info(`Blocked user ${user_id}. Reason: ${reason || 'No reason provided'}`);
            return true;
        } catch (error) {
            log.error(`Failed to block user ${user_id}:`, error);
            return false;
        }
    }

    async unblockUser(user_id) {
        try {
            await User.where("id", user_id).update({
                is_blocked: false,
                blocked_reason: null,
                blocked_at: null
            });

            this.clearUserCache(user_id);
            log.info(`Unblocked user ${user_id}`);
            return true;
        } catch (error) {
            log.error(`Failed to unblock user ${user_id}:`, error);
            return false;
        }
    }

    async blockChat(chat_id, reason = null) {
        try {
            await Chat.where("id", chat_id).update({
                is_blocked: true,
                blocked_reason: reason,
                blocked_at: new Date()
            });

            this.clearUserCache(null, chat_id);
            log.info(`Blocked chat ${chat_id}. Reason: ${reason || 'No reason provided'}`);
            return true;
        } catch (error) {
            log.error(`Failed to block chat ${chat_id}:`, error);
            return false;
        }
    }

    async unblockChat(chat_id) {
        try {
            await Chat.where("id", chat_id).update({
                is_blocked: false,
                blocked_reason: null,
                blocked_at: null
            });

            this.clearUserCache(null, chat_id);
            log.info(`Unblocked chat ${chat_id}`);
            return true;
        } catch (error) {
            log.error(`Failed to unblock chat ${chat_id}:`, error);
            return false;
        }
    }

    // Statistics and monitoring
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            adminCount: this.admin.length,
            rootUsersCount: this.root.length,
            cacheHitRate: this.getCacheHitRate()
        };
    }

    getCacheHitRate() {
        // This would need to be implemented with counters
        // for tracking cache hits vs misses
        return 0; // Placeholder
    }

    // Cleanup method
    destroy() {
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        this.cache.clear();
        log.debug('Auth helper destroyed');
    }
}