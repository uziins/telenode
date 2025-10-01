import Model from "letsql";

/**
 * Configurations Model
 * Stores runtime configuration in database
 */
export default class Configurations extends Model {
    constructor() {
        super();

        this.table = "configurations";
        this.fillable = ["`key`", "value", "type", "category", "is_encrypted", "description", "created_by"];
        this.casts = {
            is_encrypted: "boolean"
        };
    }

    /**
     * Find configuration by key
     * @param {string} key - Configuration key
     * @returns {Promise<object|null>}
     */
    async findByKey(key) {
        try {
            return await this.select()
                .where("`key`", key)
                .first();
        } catch (error) {
            console.error('Error finding configuration by key:', error);
            return null;
        }
    }

    /**
     * Find configurations by prefix
     * @param {string} prefix - Key prefix
     * @returns {Promise<Array>}
     */
    async findByPrefix(prefix) {
        try {
            return await this.select()
                .where("`key`", "LIKE", `${prefix}%`)
                .get();
        } catch (error) {
            console.error('Error finding configurations by prefix:', error);
            return [];
        }
    }

    /**
     * Get all configurations
     * @returns {Promise<Array>}
     */
    async findAll() {
        try {
            return await this.select().get();
        } catch (error) {
            console.error('Error getting all configurations:', error);
            return [];
        }
    }

    /**
     * Get configuration value by key
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value if not found
     * @returns {Promise<any>}
     */
    async getValue(key, defaultValue = null) {
        try {
            const config = await this.findByKey(key);
            if (!config) {
                return defaultValue;
            }

            // Parse JSON value
            try {
                return JSON.parse(config.value);
            } catch {
                return config.value;
            }
        } catch (error) {
            console.error('Error getting configuration value:', error);
            return defaultValue;
        }
    }

    /**
     * Set configuration value
     * @param {string} key - Configuration key
     * @param {any} value - Configuration value
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>}
     */
    async setValue(key, value, options = {}) {
        try {
            const type = this._getValueType(value);
            const category = this._determineCategory(key);

            const configData = {
                '`key`': key,
                value: JSON.stringify(value),
                type,
                category,
                is_encrypted: options.isEncrypted || false,
                description: options.description || null,
                created_by: options.createdBy || 'system'
            };

            const existing = await this.findByKey(key);

            if (existing) {
                const result = await this.where("`key`", key).update(configData);
                return !!result;
            } else {
                const result = await this.insert(configData);
                return !!result;
            }
        } catch (error) {
            console.error('Error setting configuration value:', error);
            return false;
        }
    }

    /**
     * Delete configuration by key
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>}
     */
    async deleteByKey(key) {
        try {
            const result = await this.where("`key`", key).delete();
            return !!result;
        } catch (error) {
            console.error('Error deleting configuration:', error);
            return false;
        }
    }

    /**
     * Check if configuration exists
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        try {
            const config = await this.findByKey(key);
            return !!config;
        } catch (error) {
            console.error('Error checking configuration existence:', error);
            return false;
        }
    }

    /**
     * Get configurations by category
     * @param {string} category - Configuration category
     * @returns {Promise<Array>}
     */
    async getByCategory(category) {
        try {
            return await this.select()
                .where("category", category)
                .get();
        } catch (error) {
            console.error('Error getting configurations by category:', error);
            return [];
        }
    }

    /**
     * Set plugin configuration value
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @param {any} value - Configuration value
     * @param {Object} options - Additional options
     * @returns {Promise<boolean>}
     */
    async setPluginConfig(pluginName, configKey, value, options = {}) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.setValue(key, value, {
            ...options,
            category: 'plugin',
            description: options.description || `${pluginName} plugin configuration`
        });
    }

    /**
     * Get plugin configuration value
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @param {any} defaultValue - Default value if not found
     * @returns {Promise<any>}
     */
    async getPluginConfig(pluginName, configKey, defaultValue = null) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.getValue(key, defaultValue);
    }

    /**
     * Delete plugin configuration
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @returns {Promise<boolean>}
     */
    async deletePluginConfig(pluginName, configKey) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.deleteByKey(key);
    }

    /**
     * Get all plugin configurations
     * @param {string} pluginName - Plugin name
     * @returns {Promise<Array>}
     */
    async getPluginConfigs(pluginName) {
        const prefix = `plugins.${pluginName}.`;
        return await this.findByPrefix(prefix);
    }

    /**
     * Check if plugin configuration exists
     * @param {string} pluginName - Plugin name
     * @param {string} configKey - Configuration key
     * @returns {Promise<boolean>}
     */
    async pluginConfigExists(pluginName, configKey) {
        const key = `plugins.${pluginName}.${configKey}`;
        return await this.exists(key);
    }

    /**
     * Determine value type
     * @param {any} value
     * @returns {string}
     * @private
     */
    _getValueType(value) {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'string';
        if (typeof value === 'object') return 'object';
        return typeof value;
    }

    /**
     * Determine configuration category
     * @param {string} key
     * @returns {string}
     * @private
     */
    _determineCategory(key) {
        if (key.startsWith('plugins.')) return 'plugin';
        if (key.startsWith('global.')) return 'global';
        if (key.startsWith('system.')) return 'system';
        return 'general';
    }
}
