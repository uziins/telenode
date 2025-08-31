import Configurations from '../models/configurations.js';

class ConfigManager {
    constructor() {
        this.config = new Configurations();
        this.cache = new Map(); // In-memory cache for better performance
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {any} value - Configuration value
     * @param {boolean} persistent - Whether to save to database
     * @param {object} options - Additional options like createdBy
     * @returns {Promise<boolean>}
     */
    async set(key, value, persistent = true, options = {}) {
        try {
            if (!persistent) {
                // Only set in cache
                this.cache.set(key, {
                    value,
                    timestamp: Date.now()
                });
                return true;
            }

            const success = await this.config.setValue(key, value, {
                createdBy: options.createdBy || 'system',
                description: options.description,
                isEncrypted: options.isEncrypted || false
            });

            if (success) {
                // Update cache
                this.cache.set(key, {
                    value,
                    timestamp: Date.now()
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error setting configuration:', error);
            return false;
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value if not found
     * @returns {Promise<any>}
     */
    async get(key, defaultValue = null) {
        try {
            // Check cache first
            const cached = this.cache.get(key);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.value;
            }

            // Get from database
            const value = await this.config.getValue(key, defaultValue);

            if (value !== defaultValue) {
                // Update cache
                this.cache.set(key, {
                    value,
                    timestamp: Date.now()
                });
            }

            return value;
        } catch (error) {
            console.error('Error getting configuration:', error);
            return defaultValue;
        }
    }

    /**
     * Check if a configuration exists
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>}
     */
    async has(key) {
        try {
            // Check cache first
            if (this.cache.has(key)) {
                return true;
            }

            // Check database
            return await this.config.exists(key);
        } catch (error) {
            console.error('Error checking configuration existence:', error);
            return false;
        }
    }

    /**
     * Delete a configuration
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>}
     */
    async delete(key) {
        try {
            const result = await this.config.deleteByKey(key);
            if (result) {
                // Remove from cache
                this.cache.delete(key);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error deleting configuration:', error);
            return false;
        }
    }

    /**
     * Get configurations by prefix
     * @param {string} prefix - Key prefix
     * @returns {Promise<object>}
     */
    async getByPrefix(prefix) {
        try {
            const configs = await this.config.findByPrefix(prefix);
            const result = {};

            configs.forEach(config => {
                try {
                    result[config.key] = JSON.parse(config.value);
                } catch {
                    result[config.key] = config.value;
                }
            });

            return result;
        } catch (error) {
            console.error('Error getting configurations by prefix:', error);
            return {};
        }
    }

    /**
     * Set plugin configuration
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @param {any} value - Configuration value
     * @param {boolean} persistent - Whether to save to database
     * @param {object} options - Additional options
     * @returns {Promise<boolean>}
     */
    async setPluginConfig(pluginName, configKey, value, persistent = true, options = {}) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.set(key, value, persistent, options);
    }

    /**
     * Get plugin configuration
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @param {any} defaultValue - Default value
     * @returns {Promise<any>}
     */
    async getPluginConfig(pluginName, configKey, defaultValue = null) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.get(key, defaultValue);
    }

    /**
     * Export all configurations
     * @returns {Promise<object>}
     */
    async export() {
        try {
            const configs = await this.config.findAll();
            const result = {};

            configs.forEach(config => {
                try {
                    result[config.key] = JSON.parse(config.value);
                } catch {
                    result[config.key] = config.value;
                }
            });

            return result;
        } catch (error) {
            console.error('Error exporting configurations:', error);
            return {};
        }
    }

    /**
     * Get configuration statistics
     * @returns {Promise<object>}
     */
    async getStats() {
        try {
            const configs = await this.config.findAll();
            const stats = {
                total: configs.length,
                global: 0,
                plugins: new Set()
            };

            configs.forEach(config => {
                if (config.key.startsWith('plugins.')) {
                    const pluginName = config.key.split('.')[1];
                    stats.plugins.add(pluginName);
                } else {
                    stats.global++;
                }
            });

            stats.plugins = stats.plugins.size;
            return stats;
        } catch (error) {
            console.error('Error getting configuration stats:', error);
            return { total: 0, global: 0, plugins: 0 };
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export singleton instance
export default new ConfigManager();
