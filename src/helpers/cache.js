import Logger from "../logger.js";
import config from "../config.js";

const log = Logger(config.APP_NAME, 'cache', config.LOG_LEVEL);

export default class CacheHelper {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || config.cache.ttl * 1000; // Convert to milliseconds
        this.maxSize = options.maxSize || config.cache.maxSize;
        
        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        // Cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.ttl);
        
        log.debug('Cache helper initialized');
    }

    set(key, value, customTtl = null) {
        const expireAt = Date.now() + (customTtl || this.ttl);
        
        // Check if we need to evict old entries
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        
        this.cache.set(key, {
            value,
            expireAt,
            createdAt: Date.now(),
            accessCount: 0
        });
        
        this.stats.sets++;
        log.debug(`Cache set: ${key}`);
    }

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        if (Date.now() > item.expireAt) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.deletes++;
            return null;
        }
        
        // Update access statistics
        item.accessCount++;
        item.lastAccessed = Date.now();
        
        this.stats.hits++;
        return item.value;
    }

    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        if (Date.now() > item.expireAt) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.deletes += size;
        log.debug('Cache cleared');
    }

    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expireAt) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.stats.deletes += cleanedCount;
            log.debug(`Cleaned up ${cleanedCount} expired cache entries`);
        }
    }

    evictOldest() {
        if (this.cache.size === 0) return;
        
        // Find oldest entry by creation time
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            if (item.createdAt < oldestTime) {
                oldestTime = item.createdAt;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            log.debug(`Evicted oldest cache entry: ${oldestKey}`);
        }
    }

    // Enhanced eviction with LRU strategy
    evictLRU() {
        if (this.cache.size === 0) return;
        
        let lruKey = null;
        let lruTime = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            const lastAccess = item.lastAccessed || item.createdAt;
            if (lastAccess < lruTime) {
                lruTime = lastAccess;
                lruKey = key;
            }
        }
        
        if (lruKey) {
            this.cache.delete(lruKey);
            this.stats.evictions++;
            log.debug(`Evicted LRU cache entry: ${lruKey}`);
        }
    }

    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
        
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: hitRate.toFixed(2) + '%',
            memoryUsage: this.getMemoryUsage()
        };
    }

    getMemoryUsage() {
        // Rough estimation of memory usage
        let totalSize = 0;
        for (const [key, item] of this.cache.entries()) {
            totalSize += key.length * 2; // String length * 2 for Unicode
            totalSize += JSON.stringify(item.value).length * 2;
            totalSize += 64; // Overhead for timestamps and metadata
        }
        return `${(totalSize / 1024).toFixed(2)} KB`;
    }

    // Batch operations
    mget(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    mset(keyValuePairs, customTtl = null) {
        for (const [key, value] of Object.entries(keyValuePairs)) {
            this.set(key, value, customTtl);
        }
    }

    // Pattern-based operations
    keys(pattern = '*') {
        const keys = Array.from(this.cache.keys());
        
        if (pattern === '*') {
            return keys;
        }
        
        // Simple pattern matching (supports * wildcard)
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return keys.filter(key => regex.test(key));
    }

    deletePattern(pattern) {
        const keysToDelete = this.keys(pattern);
        let deletedCount = 0;
        
        for (const key of keysToDelete) {
            if (this.delete(key)) {
                deletedCount++;
            }
        }
        
        return deletedCount;
    }

    // Cache warming
    async warmup(dataLoader, keys) {
        const warmupPromises = keys.map(async (key) => {
            try {
                const value = await dataLoader(key);
                this.set(key, value);
            } catch (error) {
                log.error(`Failed to warm up cache for key ${key}:`, error);
            }
        });
        
        await Promise.allSettled(warmupPromises);
        log.info(`Cache warmup completed for ${keys.length} keys`);
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
        log.debug('Cache helper destroyed');
    }
}

// Export singleton instance
export const globalCache = new CacheHelper();
