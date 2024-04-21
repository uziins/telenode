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
            return this.bot.editMessageReplyMarkup({
                inline_keyboard: await this.getKeyboards()
            }, {
                chat_id: message.message.chat.id,
                message_id: message.message.message_id
            })
        }

        if (cmd === 'su_plugins') {
            if (par1 && par2) {
                if (par1 === 'enable') {
                    await this.pm.loadPlugin(par2)
                } else {
                    await this.pm.unloadPlugin(par2)
                }
                return this.bot.editMessageReplyMarkup({
                    inline_keyboard: await this.getKeyboards('plugins')
                }, {
                    chat_id: message.message.chat.id,
                    message_id: message.message.message_id
                })
            } else {
                return this.bot.editMessageReplyMarkup({
                    inline_keyboard: await this.getKeyboards('plugins')
                }, {
                    chat_id: message.message.chat.id,
                    message_id: message.message.message_id
                })
            }
        }
    }

    async getKeyboards(page = '') {
        switch (page) {
            case 'plugins':
                let plugins = await PluginTbl.get();
                let keyboard = plugins.map(pl => {
                    let status = pl.is_active ? '☑️' : '✖️';
                    let command = pl.is_active ? 'disable' : 'enable';
                    return [
                        {text: `${pl.name} ${status}`, callback_data: `su_plugins ${command} ${pl.plugin_name}`}
                    ]
                })
                keyboard.push([
                    {text: "<< Back", callback_data: "su_main"}
                ])
                return keyboard;
            default:
                return [
                    [
                        {text: "Plugins", callback_data: "su_plugins"}
                    ]
                ]
        }
    }
}