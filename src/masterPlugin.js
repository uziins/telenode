import Plugin from "./plugin.js";
import PluginModel from "./models/plugins.js";

const PluginTbl = new PluginModel();
export default class MasterPlugin extends Plugin {
    constructor(listener, pm, config, auth) {
        super(listener, pm, config, auth);
        this.auth = auth;
        this.pm = pm;
        this.bot = pm.bot;
    }

    get plugin() {
        return {
            name: "Master Plugin",
            description: "",
            help: "This plugin has access to PluginManager and will perform all the 'meta'/'super' actions.",

            type: Plugin.TYPE.SPECIAL,
            visibility: Plugin.VISIBILITY.HIDDEN
        };
    }

    // get commands() {
    //     return {
    //         su: ({args}) => {
    //             try {
    //                 this.auth.init().then(() => {
    //                     console.log(this.auth.isRoot(41004212), args)
    //                 })
    //             } catch (error) {
    //                 console.log(error)
    //             }
    //         }
    //     };
    // }

    // TODO: implement sudoers only command


    async onCommand({message, command, args, chat_id}) {
        if (command === "su") {
            return this.sendMessage(chat_id, 'System Menu', {
                reply_markup: {
                    inline_keyboard: await this.getKeyboards('main')
                }
            });
        }
    }

    async onCallbackQuery({message}) {
        let [cmd, par1, par2] = message.data.split(" ");
        if (cmd === 'su_main') {
            return this.bot.editMessageText('System Settings', {
                chat_id: message.message.chat.id,
                message_id: message.message.message_id,
                reply_markup: {
                    inline_keyboard: await this.getKeyboards()
                }
            })
        }

        if (cmd === 'su_plugins') {
            if (par1 && par2) {
                if (par1 === 'detail') {
                    let plugin = await PluginTbl.getPlugin(par2);
                    // edit message text with plugin details
                    return this.bot.editMessageText(`Plugin: ${plugin.name}\nDescription: ${plugin.description}\nHelp: ${plugin.help}`, {
                        chat_id: message.message.chat.id,
                        message_id: message.message.message_id,
                        reply_markup: {
                            inline_keyboard: await this.getKeyboards('plugin_detail', {plugin, is_active: plugin.is_active})
                        }
                    })
                }
                if (par1 === 'enable') {
                    await this.pm.loadPlugin(par2)
                } else if (par1 === 'disable') {
                    await this.pm.unloadPlugin(par2)
                }
            }
            return this.bot.editMessageText('Plugin List', {
                chat_id: message.message.chat.id,
                message_id: message.message.message_id,
                reply_markup: {
                    inline_keyboard: await this.getKeyboards('plugins')
                }
            })
        }
    }

    async getKeyboards(page = '', args = {}) {
        switch (page) {
            case 'plugins':
                const plugins = await PluginTbl.get();
                const btnPerRow = 2;
                let keyboard = [];
                for (let i = 0; i < plugins.length; i += btnPerRow) {
                    let row = [];
                    for (let j = 0; j < btnPerRow; j++) {
                        let pl = plugins[i + j];
                        if (!pl) break;
                        let status = pl.is_active ? '☑️' : '✖️';
                        let command = 'detail';
                        row.push({text: `${pl.name} ${status}`, callback_data: `su_plugins ${command} ${pl.plugin_name}`})
                    }
                    keyboard.push(row)
                }
                keyboard.push([
                    {text: "<< Back", callback_data: "su_main"}
                ])
                return keyboard;
            case 'plugin_detail':
                return [
                    [
                        {text: args.is_active ? 'Disable' : 'Enable', callback_data: `su_plugins ${args.is_active ? 'disable' : 'enable'} ${args.plugin.plugin_name}`},
                    ],
                    [
                        {text: "<< Back", callback_data: "su_plugins"}
                    ]
                ]
            default:
                return [
                    [
                        {text: "Plugins", callback_data: "su_plugins"}
                    ]
                ]
        }
    }
}