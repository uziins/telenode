// credit: https://github.com/Telegram-Bot-Node/Nikoro

import Logger from "./logger.js";
/**
 * @typedef {Object} Handlers
 * @property {Function} [message]
 * @property {Function} [text]
 * @property {Function} [audio]
 * @property {Function} [document]
 * @property {Function} [photo]
 * @property {Function} [sticker]
 * @property {Function} [video]
 * @property {Function} [voice]
 * @property {Function} [contact]
 * @property {Function} [location]
 * @property {Function} [new_chat_members]
 * @property {Function} [left_chat_member]
 * @property {Function} [new_chat_title]
 * @property {Function} [new_chat_photo]
 * @property {Function} [delete_chat_photo]
 * @property {Function} [group_chat_created]
 * @property {Function} [game]
 * @property {Function} [pinned_message]
 * @property {Function} [poll]
 * @property {Function} [dice]
 * @property {Function} [migrate_from_chat_id]
 * @property {Function} [migrate_to_chat_id]
 * @property {Function} [channel_chat_created]
 * @property {Function} [supergroup_chat_created]
 * @property {Function} [successful_payment]
 * @property {Function} [invoice]
 * @property {Function} [video_note]
 * @property {Function} [callback_query]
 * @property {Function} [inline_query]
 * @property {Function} [chosen_inline_result]
 * @property {Function} [channel_post]
 * @property {Function} [edited_message]
 * @property {Function} [edited_message_text]
 * @property {Function} [edited_message_caption]
 * @property {Function} [edited_channel_post]
 * @property {Function} [edited_channel_post_text]
 * @property {Function} [edited_channel_post_caption]
 * @property {Function} [shipping_query]
 * @property {Function} [pre_checkout_query]
 * @property {Function} [poll_answer]
 * @property {Function} [chat_member]
 * @property {Function} [my_chat_member]
 * @property {Function} [chat_join_request]
 */

export default class Plugin {
    constructor(listener, bot, config) {
        this.listener = listener;
        this._handlers = {};

        this.log = new Logger(this.plugin.name, config);

        const events = Object.keys(Plugin.handlers);
        for (const eventName of events) {
            const handler = Plugin.handlers[eventName];
            if (typeof this[handler] !== 'function') continue;
            const eventHandler = this[handler].bind(this);
            const wrappedHandler = function ({message}) {
                // TODO: filter blocked chats here, so we don't call the handler
                eventHandler.apply(null, arguments);
            };
            this.listener.on(eventName, wrappedHandler);
            this._handlers[eventName] = wrappedHandler; // handler reference for later removal
        }

        /* this.commands can contain an object, mapping command names (e.g. "ping") to either:
         *
         *   - a string, in which case the string is sent as a message
         *   - an object, in which case it is sent with the appropriate message type
         */
        const shortcutHandler = ({message, command, args}) => {
            if (!this.commands) return;
            for (const trigger of Object.keys(this.commands)) {
                if (command !== trigger) continue;
                const ret = this.commands[trigger]({message, args});
                if (typeof ret === "string" || typeof ret === "number") {
                    this.sendMessage(message.chat.id, ret);
                    return;
                }
                if (typeof ret === "undefined")
                    return;
                switch (ret.type) {
                    case "text": {
                        return this.sendMessage(message.chat.id, ret.text, ret.options);
                    }

                    case "audio": {
                        return this.sendAudio(message.chat.id, ret.audio, ret.options);
                    }

                    case "document": {
                        return this.sendDocument(message.chat.id, ret.document, ret.options);
                    }

                    case "photo": {
                        return this.sendPhoto(message.chat.id, ret.photo, ret.options);
                    }

                    case "sticker": {
                        return this.sendSticker(message.chat.id, ret.sticker, ret.options);
                    }

                    case "video": {
                        return this.sendVideo(message.chat.id, ret.video, ret.options);
                    }

                    case "voice": {
                        return this.sendVoice(message.chat.id, ret.voice, ret.options);
                    }

                    case "status":
                    case "chatAction": {
                        return this.sendChatAction(message.chat.id, ret.status, ret.options);
                    }

                    default: {
                        const errorMessage = `Unrecognized reply type ${ret.type}`;
                        this.log.error(errorMessage);
                        return Promise.reject(errorMessage);
                    }
                }
            }
        };
        if (this.listener) {
            this.listener.on("_command", shortcutHandler);
        }
        this.shortcutHandler = shortcutHandler;
    }

    static get VISIBILITY() {
        return {
            VISIBLE: 0,
            HIDDEN: 1
        };
    }

    // TODO: tentukan tipe dan kegunaannya
    static get TYPE() {
        return {
            NORMAL: 0x01,
            INLINE: 0x02,
            PROXY: 0x03,
            SPECIAL: 0x04
        };
    }

    // TODO: apakah level perlu?
    static get LEVEL() {
        return {
            ROOT: 0x00,
            ADMIN: 0x01,
            USER: 0x02,
        };
    }

    static get plugin() {
        return {
            name: 'Plugin',
            description: '',
            help: 'Don\'t ask for help',
            visibility: Plugin.VISIBILITY.VISIBLE,
            type: Plugin.TYPE.SPECIAL
        }
    }

    /**
     * @type {Handlers}
     */
    static get handlers() {
        return {
            message: 'onMessage',

            _command: "onCommand",
            _inline_command: "onInlineCommand",

            text: 'onText',
            audio: 'onAudio',
            document: 'onDocument',
            photo: 'onPhoto',
            sticker: 'onSticker',
            video: 'onVideo',
            voice: 'onVoice',
            contact: 'onContact',
            location: 'onLocation',
            new_chat_members: 'onNewChatMembers',
            left_chat_member: 'onLeftChatMember',
            new_chat_title: 'onNewChatTitle',
            new_chat_photo: 'onNewChatPhoto',
            delete_chat_photo: 'onDeleteChatPhoto',
            group_chat_created: 'onGroupChatCreated',
            game: 'onGame',
            pinned_message: 'onPinnedMessage',
            poll: 'onPoll',
            dice: 'onDice',
            migrate_from_chat_id: 'onMigrateFromChatId',
            migrate_to_chat_id: 'onMigrateToChatId',
            channel_chat_created: 'onChannelChatCreated',
            supergroup_chat_created: 'onSupergroupChatCreated',
            successful_payment: 'onSuccessfulPayment',
            invoice: 'onInvoice',
            video_note: 'onVideoNote',

            callback_query: 'onCallbackQuery',
            inline_query: 'onInlineQuery',
            chosen_inline_result: 'onChosenInlineResult',
            channel_post: 'onChannelPost',
            edited_message: 'onEditedMessage',
            edited_message_text: 'onEditedMessageText',
            edited_message_caption: 'onEditedMessageCaption',
            edited_channel_post: 'onEditedChannelPost',
            edited_channel_post_text: 'onEditedChannelPostText',
            edited_channel_post_caption: 'onEditedChannelPostCaption',
            shipping_query: 'onShippingQuery',
            pre_checkout_query: 'onPreCheckoutQuery',
            poll_answer: 'onPollAnswer',
            chat_member: 'onChatMember',
            my_chat_member: 'onMyChatMember',
            chat_join_request: 'onChatJoinRequest',
        }
    }

    get plugin() {
        return this.constructor.plugin;
    }


    stop() {
        const eventNames = Object.keys(this._handlers);
        if (this.listener) {
            for (const eventName of eventNames) {
                const handler = this._handlers[eventName];
                this.listener.removeListener(eventName, handler);
            }
            this.listener.removeListener("_command", this.shortcutHandler);
        }
    }
}