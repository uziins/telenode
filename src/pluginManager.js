// credit: https://github.com/Telegram-Bot-Node/Nikoro

import fs from "fs";
import path from "path";
import {EventEmitter} from "events";
import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";
import Logger from "./logger.js";
import MasterPlugin from "./masterPlugin.js";
import authHelper from "./helpers/auth.js";
import PluginPackageManager from "./helpers/pluginPackageManager.js";

const PluginTbl = new PluginModel();

export default class PluginManager {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;
        this.auth = new authHelper();
        this.plugins = new Map(); // Use Map for better performance
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(100); // Increase limit for many plugins

        // Plugin loading state
        this.isLoading = false;
        this.loadedPlugins = new Set();

        // Cache for plugin metadata
        this.pluginMetaCache = new Map();

        // Plugin package manager
        this.packageManager = new PluginPackageManager(config);

        this.log = Logger(this.config.APP_NAME, 'pluginManager', this.config.LOG_LEVEL);

        // Initialize master plugin
        this.masterPlugin = new MasterPlugin(this.emitter, this, this.auth);
        this.masterPlugin.sendMessage = this.bot.sendMessage.bind(this.bot);

        // Setup bot event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const events = Object.keys(Plugin.handlers)
            .filter(prop => prop !== "message" && prop[0] !== "_");

        for (const eventName of events) {
            this.bot.on(eventName, async (message) => {
                try {
                    // Process proxy plugins first
                    const proxyPlugins = Array.from(this.plugins.values())
                        .filter(plugin => (plugin.plugin.type & Plugin.TYPE.PROXY) === Plugin.TYPE.PROXY);

                    await Promise.all(proxyPlugins.map(plugin =>
                        this.safeExecute(() => plugin.proxy(eventName, message))
                    ));

                    // Emit events with correct structure
                    this.emit("message", message);
                    this.emit(eventName, message);
                } catch (error) {
                    this.log.error(`Error processing ${eventName} event:`, error);
                }
            });
        }
    }

    async safeExecute(fn) {
        try {
            return await fn();
        } catch (error) {
            this.log.error('Safe execution error:', error);
            return null;
        }
    }

    async safeEmit(event, data) {
        try {
            this.emitter.emit(event, data);
        } catch (error) {
            this.log.error(`Error emitting ${event}:`, error);
        }
    }

    async loadPlugins() {
        if (this.isLoading) {
            this.log.warn('Plugin loading already in progress');
            return;
        }

        this.isLoading = true;
        const pluginsDir = 'plugins';

        try {
            if (!fs.existsSync(pluginsDir)) {
                this.log.warn(`Plugins directory ${pluginsDir} does not exist`);
                return;
            }

            const pluginDirs = await fs.promises.readdir(pluginsDir);

            // Pre-populate cache with plugin metadata
            await this.prePopulatePluginCache(pluginDirs);

            const pluginLoadPromises = [];

            for (const pluginDir of pluginDirs) {
                const pluginPath = path.join(process.cwd(), 'plugins', pluginDir, 'index.js');

                if (await this.isValidPluginPath(pluginPath)) {
                    pluginLoadPromises.push(this.loadSinglePlugin(pluginDir, pluginPath));
                }
            }

            // Load plugins concurrently but with error isolation
            const results = await Promise.allSettled(pluginLoadPromises);

            let successCount = 0;
            let errorCount = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    errorCount++;
                    const pluginName = pluginDirs[index];
                    this.log.error(`Failed to load plugin ${pluginName}:`, result.reason);

                    // Clean up failed plugin from caches
                    this.loadedPlugins.delete(pluginName);
                    this.plugins.delete(pluginName);
                    // Keep pluginMetaCache for failed plugins for debugging/info purposes
                }
            });

            this.log.info(`Plugin loading completed: ${successCount} successful, ${errorCount} failed`);

            // Clean up plugins not in directory
            await this.cleanupRemovedPlugins(pluginDirs);

            // Validate cache consistency
            this.validateCacheConsistency();

        } catch (error) {
            this.log.error('Error during plugin loading:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async isValidPluginPath(pluginPath) {
        try {
            const stats = await fs.promises.stat(pluginPath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    async loadSinglePlugin(pluginName, pluginPath) {
        try {
            // Check if plugin is already loaded
            if (this.loadedPlugins.has(pluginName)) {
                this.log.debug(`Plugin ${pluginName} already loaded, skipping`);
                return;
            }

            // Dynamic import with cache busting
            const cacheBuster = `?v=${Date.now()}`;
            if (!pluginPath){
                pluginPath = path.join(process.cwd(), 'plugins', pluginName, 'index.js');
            }
            const ThePluginModule = await import(pluginPath + cacheBuster);

            if (!ThePluginModule.default) {
                throw new Error(`Plugin ${pluginName} does not have a default export`);
            }

            const pluginDetail = ThePluginModule.default.plugin;
            if (!pluginDetail) {
                throw new Error(`Plugin ${pluginName} does not have plugin metadata`);
            }

            // Check plugin status in database
            const dbPlugin = await PluginTbl.getPlugin(pluginName, pluginDetail);
            if (!dbPlugin || !dbPlugin.is_active) {
                this.log.debug(`Plugin ${pluginName} is not active, skipping`);
                return;
            }

            // Create plugin instance
            const pluginInstance = new ThePluginModule.default(this.emitter, this.bot, this.auth);

            if (!(pluginInstance instanceof Plugin)) {
                throw new Error(`Plugin ${pluginName} does not extend the Plugin class`);
            }

            // Bind bot methods to plugin
            this.bindBotMethods(pluginInstance);

            // Store plugin
            this.plugins.set(pluginName, pluginInstance);
            this.loadedPlugins.add(pluginName);
            this.pluginMetaCache.set(pluginName, pluginDetail);

            // Update plugin status in database
            await PluginTbl.where("plugin_name", pluginName).update({is_active: true});

            this.log.info(`Plugin ${pluginName} loaded successfully`);

        } catch (error) {
            this.log.error(`Error loading plugin ${pluginName}:`, error);
            throw error;
        }
    }

    bindBotMethods(pluginInstance) {
        const botMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.bot));

        for (const method of botMethods) {
            if (typeof this.bot[method] !== "function") continue;
            if (method === "constructor" || method === "on") continue;
            if (/^_/.test(method)) continue; // Skip internal methods

            this.log.debug(`Binding method ${method} to plugin`);
            pluginInstance[method] = this.bot[method].bind(this.bot);
        }
    }

    async cleanupRemovedPlugins(currentPluginDirs) {
        try {
            await PluginTbl.deletePlugin(currentPluginDirs);
            this.log.debug('Cleaned up removed plugins from database');
        } catch (error) {
            this.log.error('Error cleaning up removed plugins:', error);
        }
    }

    async unloadPlugin(pluginName) {
        try {
            // Update database
            await PluginTbl.where("plugin_name", pluginName).update({is_active: false});

            // Stop and remove plugin
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                await this.safeExecute(() => plugin.stop());
                this.plugins.delete(pluginName);
            }

            this.loadedPlugins.delete(pluginName);
            this.pluginMetaCache.delete(pluginName);

            this.log.info(`Plugin ${pluginName} unloaded successfully`);

            // Reload all plugins to ensure consistency
            await this.reloadPlugins();

        } catch (error) {
            this.log.error(`Error unloading plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async reloadPlugins() {
        this.log.info('Reloading all plugins...');

        // Stop all plugins
        await this.stopPlugins();

        // Clear state
        this.plugins.clear();
        this.loadedPlugins.clear();
        this.pluginMetaCache.clear();

        // Reload plugins
        await this.loadPlugins();
    }

    async stopPlugins() {
        const stopPromises = Array.from(this.plugins.values())
            .map(plugin => this.safeExecute(() => plugin.stop()));

        await Promise.allSettled(stopPromises);
        this.log.info('All plugins stopped');
    }

    // Enhanced emit method with command parsing
    emit(event, message) {
        this.log.debug(`Triggered event ${event}`);

        if (event !== 'message') {
            // Handle bot commands
            if (message.text !== undefined && message.entities && message.entities[0]?.type === "bot_command") {
                const entity = message.entities[0];
                const rawCommand = message.text.slice(entity.offset + 1, entity.offset + entity.length);
                const [command] = rawCommand.replace(/\//, "").split("@");

                let args = [];
                if (entity.offset + entity.length < message.text.length) {
                    args = message.text.slice(entity.offset + entity.length + 1).split(" ").filter(arg => arg.length > 0);
                }

                const user_id = message.from.id;
                const chat_id = message.chat.id;

                this.safeEmit("_command", {message, command, args, user_id, chat_id});
            }
            // Handle inline queries
            else if (message.query !== undefined) {
                const parts = message.query.trim().split(" ");
                const command = parts[0].toLowerCase();
                const args = parts.length > 1 ? parts.slice(1) : [];
                this.safeEmit("_inline_command", {message, command, args});
            }
        }

        this.safeEmit(event, {message});
    }

    // Plugin management methods
    getLoadedPlugins() {
        return Array.from(this.plugins.keys());
    }

    getPluginInfo(pluginName) {
        return this.pluginMetaCache.get(pluginName);
    }

    isPluginLoaded(pluginName) {
        return this.loadedPlugins.has(pluginName);
    }

    async prePopulatePluginCache(pluginDirs) {
        this.log.debug('Pre-populating plugin metadata cache...');

        for (const pluginDir of pluginDirs) {
            const pluginPath = path.join(process.cwd(), 'plugins', pluginDir, 'index.js');

            if (await this.isValidPluginPath(pluginPath)) {
                try {
                    // Load plugin metadata without instantiating
                    const cacheBuster = `?v=${Date.now()}`;
                    const ThePluginModule = await import(pluginPath + cacheBuster);

                    if (ThePluginModule.default && ThePluginModule.default.plugin) {
                        const pluginDetail = ThePluginModule.default.plugin;
                        this.pluginMetaCache.set(pluginDir, pluginDetail);
                        this.log.debug(`Cached metadata for plugin: ${pluginDir}`);
                    }
                } catch (error) {
                    this.log.warn(`Failed to cache metadata for plugin ${pluginDir}:`, error.message);
                }
            }
        }
    }

    validateCacheConsistency() {
        const loadedPluginNames = Array.from(this.loadedPlugins);
        const cachedPluginNames = Array.from(this.pluginMetaCache.keys());
        const activePluginNames = Array.from(this.plugins.keys());

        this.log.debug('Cache validation:', {
            loaded: loadedPluginNames,
            cached: cachedPluginNames,
            active: activePluginNames
        });

        // pluginMetaCache should contain at least all loaded plugins
        const missingFromCache = loadedPluginNames.filter(name => !this.pluginMetaCache.has(name));
        if (missingFromCache.length > 0) {
            this.log.warn('Some loaded plugins missing from metadata cache:', missingFromCache);
        }
    }

    async activatePlugin(pluginName) {
        try {
            // Set plugin as active in database
            await PluginTbl.where("plugin_name", pluginName).update({is_active: true});

            // Load the plugin if it exists
            const pluginPath = path.join(process.cwd(), 'plugins', pluginName, 'index.js');
            if (await this.isValidPluginPath(pluginPath)) {
                await this.loadSinglePlugin(pluginName, pluginPath);
            } else {
                throw new Error(`Plugin file not found: ${pluginPath}`);
            }

            this.log.info(`Plugin ${pluginName} activated successfully`);
            return true;

        } catch (error) {
            this.log.error(`Error activating plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async deactivatePlugin(pluginName) {
        try {
            // Set plugin as inactive in database
            await PluginTbl.where("plugin_name", pluginName).update({is_active: false});

            // Stop and remove plugin if it's loaded
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                await this.safeExecute(() => plugin.stop());
                this.plugins.delete(pluginName);
            }

            this.loadedPlugins.delete(pluginName);

            this.log.info(`Plugin ${pluginName} deactivated successfully`);
            return true;

        } catch (error) {
            this.log.error(`Error deactivating plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async getPluginStatus(pluginName) {
        try {
            const dbPlugin = await PluginTbl.where("plugin_name", pluginName).first();
            return {
                exists: !!dbPlugin,
                is_active: dbPlugin ? dbPlugin.is_active : false,
                is_loaded: this.isPluginLoaded(pluginName)
            };
        } catch (error) {
            this.log.error(`Error getting plugin status ${pluginName}:`, error);
            return { exists: false, is_active: false, is_loaded: false };
        }
    }

    // Plugin Package Management Methods
    async createPlugin(pluginName, options = {}) {
        try {
            return await this.packageManager.createPluginTemplate(pluginName, options);
        } catch (error) {
            this.log.error(`Error creating plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async installPluginDependencies(pluginName) {
        try {
            return await this.packageManager.installPluginDependencies(pluginName);
        } catch (error) {
            this.log.error(`Error installing dependencies for plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async installAllPluginDependencies() {
        try {
            return await this.packageManager.installAllPluginDependencies();
        } catch (error) {
            this.log.error('Error installing all plugin dependencies:', error);
            throw error;
        }
    }

    async checkPluginDependencies(pluginName) {
        try {
            return await this.packageManager.checkPluginDependencies(pluginName);
        } catch (error) {
            this.log.error(`Error checking dependencies for plugin ${pluginName}:`, error);
            throw error;
        }
    }

    async removePlugin(pluginName) {
        try {
            // First deactivate the plugin
            await this.deactivatePlugin(pluginName);

            // Then remove from filesystem
            return await this.packageManager.removePlugin(pluginName);
        } catch (error) {
            this.log.error(`Error removing plugin ${pluginName}:`, error);
            throw error;
        }
    }
}