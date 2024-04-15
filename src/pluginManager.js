// credit: https://github.com/Telegram-Bot-Node/Nikoro

import fs from "fs";
import path from "path";
import {EventEmitter} from "events";
import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";
import Logger from "./logger.js";

const PluginTbl = new PluginModel();

export default class PluginManager {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;
        this.plugins = [];
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(0);

        this.log = new Logger('PluginManager', config);

        const events = Object.keys(Plugin.handlers)
            // We handle the message event by ourselves.
            .filter(prop => prop !== "message")
            // Events beginning with an underscore (e.g. _command) are internal.
            .filter(prop => prop[0] !== "_");

        for (const eventName of events) {
            bot.on(eventName, message => {
                Promise.all(
                    this.plugins
                        .filter(plugin => (plugin.plugin.type & Plugin.Type.PROXY) === Plugin.Type.PROXY)
                        .map(plugin => plugin.proxy(eventName, message))
                ).then(() => this.emit(
                    "message",
                    message
                )).then(() => this.emit(
                    eventName,
                    message
                )).catch(err => {
                    if (err) this.log.error("Message rejected with error", err);
                });
            });
        }
    }

    loadPlugins() {
        const pluginsDir = 'plugins';
        fs.readdir(pluginsDir, (err, plugins) => {
            if (err) {
                console.error('Error reading plugins directory', err);
                return;
            }

            // load each plugin, index.js is the entry point for the plugin
            plugins.forEach(plugin => {
                // Check if plugin is active
                PluginTbl.getPlugin(plugin).then(r => {
                    if (r && r.is_active){
                        this.loadPlugin(plugin).then(r => {}).catch(e => {
                            this.log.error(`Error loading plugin ${plugin}`, e);
                        });
                    }
                })
            });
        });
    }

    async loadPlugin(plugin) {
        const pluginPath = path.join(process.cwd(), 'plugins', plugin, 'index.js');
        if (fs.existsSync(pluginPath)) {
            const ThePluginModule = await import(pluginPath);
            const pluginInstance = new ThePluginModule.default(this.emitter, this.bot, this.config);
            if (pluginInstance instanceof Plugin) {
                console.log(`Plugin ${plugin} loaded`);
                for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(this.bot))) {
                    if (typeof this.bot[method] !== "function") continue;
                    if (method === "constructor" || method === "on") continue;
                    if (/^_/.test(method)) continue; // Do not expose internal methods
                    this.log.debug(`Binding ${method}`);
                    pluginInstance[method] = this.bot[method].bind(this.bot);
                }
                this.plugins.push(pluginInstance);
            } else {
                console.error(`Plugin ${plugin} does not extend the Plugin class`);
            }
        } else {
            console.error(`Plugin ${plugin} does not have an index.js file`);
        }
    }

    unloadPlugin(plugin) {
        this.plugins = this.plugins.filter(p => p.name !== plugin);
    }

    stopPlugins() {
        return Promise.all(this.plugins.map(plugin => plugin.stop()));
    }

    emit(event, message) {
        this.log.debug(`Triggered event ${event}`);

        if (event !== 'message') {
            if (message.text !== undefined && message.entities && message.entities[0].type === "bot_command") {
                const entity = message.entities[0];

                const rawCommand = message.text.slice(entity.offset + 1, entity.offset + entity.length);
                const [command] = rawCommand.replace(/\//, "").split("@");

                let args = [];
                if (entity.offset + entity.length < message.text.length) {
                    args = message.text.slice(entity.offset + entity.length + 1).split(" ");
                }

                this.emitter.emit("_command", {message, command, args});
            } else if (message.query !== undefined) {
                const parts = message.query.split(" ");
                const command = parts[0].toLowerCase();
                const args = parts.length > 1 ? parts.slice(1) : [];
                this.emitter.emit("_inline_command", {message, command, args});
            }
        }

        this.emitter.emit(event, {message});
    }
}