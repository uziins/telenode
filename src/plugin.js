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
    constructor(listener, bot, auth) {
        this.listener = listener;
        this.auth = auth;
        this._handlers = new Map(); // Use Map for better performance
        this._isActive = true;

        // Rate limiting for plugin commands
        this._commandRateLimit = new Map();
        this._rateLimitWindow = 60000; // 1 minute
        this._maxCommandsPerWindow = 30;

        this.log = Logger('', this.plugin.name);
        this.log.info(`Plugin ${this.plugin.name} initializing...`);

        // Validate plugin configuration
        this.validatePlugin();

        // Setup event handlers
        this.setupEventHandlers();

        // Setup command shortcuts
        this.setupCommandShortcuts();

        this.log.info(`Plugin ${this.plugin.name} loaded successfully`);
    }

    validatePlugin() {
        const plugin = this.plugin;

        if (!plugin.name || typeof plugin.name !== 'string') {
            throw new Error('Plugin must have a valid name');
        }

        if (!plugin.description || typeof plugin.description !== 'string') {
            throw new Error('Plugin must have a valid description');
        }

        // Visibility validation - support both old and new system
        const validVisibilities = [
            Plugin.VISIBILITY.VISIBLE, Plugin.VISIBILITY.HIDDEN, // Old system
            Plugin.VISIBILITY.USER, Plugin.VISIBILITY.ADMIN, Plugin.VISIBILITY.ROOT // New system
        ];

        if (plugin.visibility === undefined || !validVisibilities.includes(plugin.visibility)) {
            throw new Error('Plugin must have a valid visibility setting (ROOT, ADMIN, or USER)');
        }
    }

    setupEventHandlers() {
        const events = Object.keys(Plugin.handlers);

        for (const eventName of events) {
            const handler = Plugin.handlers[eventName];
            if (typeof this[handler] !== 'function') continue;

            const eventHandler = this[handler].bind(this);
            const wrappedHandler = this.createWrappedHandler(eventHandler, eventName);

            this.listener.on(eventName, wrappedHandler);
            this._handlers.set(eventName, wrappedHandler);
        }
    }

    createWrappedHandler(handler, eventName) {
        return async (eventData) => {
            if (!this._isActive) return;

            try {
                const { message } = eventData;

                // Check authorization
                if (!await this.auth.isGranted(message)) {
                    this.log.debug(`Access denied for event ${eventName}`);
                    return;
                }

                // Rate limiting for commands
                if (eventName === '_command' && !this.checkRateLimit(message)) {
                    this.log.warn(`Rate limit exceeded for user ${message.from?.id}`);
                    return;
                }

                // Execute handler with timeout and capture result
                const result = await this.executeWithTimeout(handler, eventData, 30000);

                // Auto-handle result for non-command events (NEW FEATURE)
                if (eventName !== '_command' && result !== undefined && result !== null && message?.chat?.id) {
                    await this.handleEventResult(result, message, eventName);
                }

            } catch (error) {
                this.log.error(`Error in ${eventName} handler:`, error);

                // Send error notification to user if it's a command
                if (eventName === '_command' && message?.chat?.id) {
                    try {
                        await this.sendMessage(message.chat.id,
                            '❌ An error occurred while processing your command.');
                    } catch (sendError) {
                        this.log.error('Failed to send error message:', sendError);
                    }
                }
            }
        };
    }

    async executeWithTimeout(handler, data, timeout) {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Handler timeout after ${timeout}ms`));
            }, timeout);

            try {
                const result = await handler(data);
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    checkRateLimit(message) {
        if (!message?.from?.id) return true;

        const userId = message.from.id;
        const now = Date.now();
        const windowStart = now - this._rateLimitWindow;

        if (!this._commandRateLimit.has(userId)) {
            this._commandRateLimit.set(userId, []);
        }

        const userCommands = this._commandRateLimit.get(userId);
        const recentCommands = userCommands.filter(time => time > windowStart);

        if (recentCommands.length >= this._maxCommandsPerWindow) {
            return false;
        }

        recentCommands.push(now);
        this._commandRateLimit.set(userId, recentCommands);

        return true;
    }

    setupCommandShortcuts() {
        if (!this.commands) {
            this.log.debug(`Plugin ${this.plugin.name} has no commands, skipping command shortcuts setup`);
            return;
        }

        this.log.info(`Setting up command shortcuts for plugin ${this.plugin.name}, commands: [${Object.keys(this.commands).join(', ')}]`);

        const shortcutHandler = async ({message, command, args}) => {
            this.log.info(`🎯 SHORTCUT HANDLER TRIGGERED: Plugin "${this.plugin.name}" received command "${command}" from user ${message.from?.id}`);

            if (!this._isActive || !this.commands) return;

            // Debug logging untuk semua command yang masuk
            this.log.info(`Command received: "${command}" from user ${message.from?.id} in chat ${message.chat?.id}`);

            try {
                if (!await this.auth.isGranted(message)) {
                    this.log.warn(`Access denied for command "${command}" from user ${message.from?.id}`);
                    return;
                }

                // Find matching command (case-insensitive)
                const commandKey = Object.keys(this.commands)
                    .find(key => key.toLowerCase() === command.toLowerCase());

                if (!commandKey) {
                    this.log.debug(`Command "${command}" not found in plugin ${this.plugin.name}`);
                    return;
                }

                this.log.info(`Executing command "${commandKey}" in plugin ${this.plugin.name}`);

                const commandHandler = this.commands[commandKey];

                if (typeof commandHandler !== 'function') {
                    this.log.warn(`Command ${commandKey} is not a function`);
                    return;
                }

                const result = await this.executeWithTimeout(
                    () => commandHandler({message, args}),
                    null,
                    30000
                );

                this.log.info(`Command "${commandKey}" executed successfully, result type: ${typeof result}`);
                await this.handleCommandResult(result, message);

            } catch (error) {
                this.log.error(`Error executing command ${command}:`, error);

                if (message?.chat?.id) {
                    try {
                        await this.sendMessage(message.chat.id,
                            '❌ Command execution failed.');
                    } catch (sendError) {
                        this.log.error('Failed to send command error message:', sendError);
                    }
                }
            }
        };

        if (this.listener) {
            this.log.info(`Registering _command event listener for plugin ${this.plugin.name}`);
            this.listener.on("_command", shortcutHandler);
            this._handlers.set("_command_shortcut", shortcutHandler);
        } else {
            this.log.error(`No listener available for plugin ${this.plugin.name}`);
        }
    }

    async handleCommandResult(result, message) {
        if (result === undefined || result === null) return;

        if (typeof result === "string" || typeof result === "number") {
            await this.sendMessage(message.chat.id, String(result));
            return;
        }

        if (typeof result === "object" && result.type) {
            await this.handleTypedResult(result, message);
        }
    }

    async handleEventResult(result, message, eventName) {
        if (result === undefined || result === null) return;

        try {
            this.log.debug(`Auto-handling result for event ${eventName}, result type: ${typeof result}`);

            if (typeof result === "string" || typeof result === "number") {
                await this.sendMessage(message.chat.id, String(result));
                return;
            }

            if (typeof result === "object" && result.type) {
                await this.handleTypedResult(result, message);
                return;
            }

            // If result is an object without type, try to send as string
            if (typeof result === "object") {
                await this.sendMessage(message.chat.id, JSON.stringify(result, null, 2));
                return;
            }

        } catch (error) {
            this.log.error(`Error auto-handling result for event ${eventName}:`, error);
        }
    }

    async handleTypedResult(result, message) {
        const { type, options = {} } = result;
        const chatId = message.chat.id;

        try {
            switch (type) {
                case "text":
                    return await this.sendMessage(chatId, result.text, options);
                case "audio":
                    return await this.sendAudio(chatId, result.audio, options);
                case "document":
                    return await this.sendDocument(chatId, result.document, options);
                case "photo":
                    return await this.sendPhoto(chatId, result.photo, options);
                case "sticker":
                    return await this.sendSticker(chatId, result.sticker, options);
                case "video":
                    return await this.sendVideo(chatId, result.video, options);
                case "voice":
                    return await this.sendVoice(chatId, result.voice, options);
                case "status":
                case "chatAction":
                    return await this.sendChatAction(chatId, result.status || result.action, options);
                default:
                    throw new Error(`Unrecognized reply type: ${type}`);
            }
        } catch (error) {
            this.log.error(`Error handling typed result:`, error);
            throw error;
        }
    }

    // Plugin lifecycle methods
    async start() {
        this._isActive = true;
        this.log.info(`Plugin ${this.plugin.name} started`);
    }

    async stop() {
        this._isActive = false;

        // Remove all event listeners
        for (const [eventName, handler] of this._handlers) {
            if (this.listener) {
                this.listener.removeListener(eventName, handler);
            }
        }

        this._handlers.clear();
        this._commandRateLimit.clear();

        this.log.info(`Plugin ${this.plugin.name} stopped`);
    }

    // Static properties and methods
    static get VISIBILITY() {
        return {
            ROOT: 0x00,
            ADMIN: 0x01,
            USER: 0x02
        };
    }

    static get TYPE() {
        return {
            NORMAL: 0x01,
            INLINE: 0x02,
            PROXY: 0x04,
            SPECIAL: 0x08
        };
    }

    static get plugin() {
        return {
            name: 'BasePlugin',
            description: 'This is the base plugin',
            help: '/help - Show help',
            visibility: Plugin.VISIBILITY.HIDDEN,
            version: '1.0.0',
            author: 'TeleNode',
        };
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
        };
    }

    get plugin() {
        return this.constructor.plugin;
    }
}
