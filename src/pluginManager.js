// credit: https://github.com/Telegram-Bot-Node/Nikoro

import fs from "fs";
import path from "path";
import {EventEmitter} from "events";
import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";
import Logger from "./logger.js";
import MasterPlugin from "./masterPlugin.js";
import authHelper from "./helpers/auth.js";

const PluginTbl = new PluginModel();

export default class PluginManager {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;
        this.auth = new authHelper();
        this.plugins = [];
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(0);

        this.log = new Logger('PluginManager', this.config);

        // load master plugin
        this.masterPlugin = new MasterPlugin(this.emitter, this, config, this.auth);
        this.masterPlugin.sendMessage = this.bot.sendMessage.bind(this.bot);

        const events = Object.keys(Plugin.handlers)
            // We handle the message event by ourselves.
            .filter(prop => prop !== "message")
            // Events beginning with an underscore (e.g. _command) are internal.
            .filter(prop => prop[0] !== "_");

        for (const eventName of events) {
            bot.on(eventName, message => {
                Promise.all(
                    this.plugins
                        .filter(plugin => (plugin.plugin.type & Plugin.TYPE.PROXY) === Plugin.TYPE.PROXY)
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

            // (soft) delete plugins that are not in the plugins directory (if any)
            PluginTbl.deletePlugin(plugins).then(r => {});
        });
    }

    async loadPlugin(plugin) {
        const pluginPath = path.join(process.cwd(), 'plugins', plugin, 'index.js');
        if (fs.existsSync(pluginPath)) {
            const ThePluginModule = await import(pluginPath);
            const pluginInstance = new ThePluginModule.default(this.emitter, this.bot, this.auth);
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
                // update plugin record
                PluginTbl.where("plugin_name", plugin).update({
                    name: pluginInstance.plugin.name,
                    description: pluginInstance.plugin.description,
                    help: pluginInstance.plugin.help,
                    is_visible: pluginInstance.plugin.visibility === Plugin.VISIBILITY.VISIBLE,
                    is_active: true}).then(r => {});
            } else {
                console.error(`Plugin ${plugin} does not extend the Plugin class`);
            }
        } else {
            console.error(`Plugin ${plugin} does not have an index.js file`);
        }
    }

    unloadPlugin(plugin) {
        PluginTbl.where("plugin_name", plugin).update({is_active: false}).then(r => {});
        this.plugins = this.plugins.filter(p => p.plugin_name !== plugin);
        this.stopPlugins().then(r => {
            this.loadPlugins()
        })
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

                let user_id = message.from.id;
                let chat_id = message.chat.id;

                this.emitter.emit("_command", {message, command, args, user_id, chat_id});
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