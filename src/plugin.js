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
        this.bot = bot;
        this.auth = auth;
        this._handlers = new Map(); // Use Map for better performance
        this._isActive = true;

        // Rate limiting for plugin commands
        this._commandRateLimit = new Map();
        this._rateLimitWindow = 60000; // 1 minute
        this._maxCommandsPerWindow = 30;

        // Note: Plugin name will be set by PluginManager when the plugin is loaded
        this.log = Logger('', 'Plugin');
        this.log.info(`Plugin initializing...`);

        // Setup event handlers
        this.setupEventHandlers();

        // Setup command shortcuts
        this.setupCommandShortcuts();

        this.log.info(`Plugin loaded successfully`);
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

    /**
     * Proxy method for PROXY type plugins
     * This method is called before normal event processing
     * Override this method in proxy plugins to implement middleware functionality
     * @param {string} eventName - The event name being processed
     * @param {Object} eventData - The event data (message, callback_query, etc.)
     * @returns {Object|null} Modified event data or null to stop processing
     */
    async proxy(eventName, eventData) {
        // Default implementation does nothing
        // Proxy plugins should override this method
        return eventData;
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
            this.log.debug(`Plugin has no commands, skipping command shortcuts setup`);
            return;
        }

        this.log.info(`Setting up command shortcuts, commands: [${Object.keys(this.commands).join(', ')}]`);

        const shortcutHandler = async ({message, command, args}) => {
            this.log.info(`🎯 SHORTCUT HANDLER TRIGGERED: Plugin received command "${command}" from user ${message.from?.id}`);

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
                    this.log.debug(`Command "${command}" not found in plugin`);
                    return;
                }

                this.log.info(`Executing command "${commandKey}" in plugin`);

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
            this.log.info(`Registering _command event listener for plugin`);
            this.listener.on("_command", shortcutHandler);
            this._handlers.set("_command_shortcut", shortcutHandler);
        } else {
            this.log.error(`No listener available for plugin`);
        }
    }

    async handleCommandResult(result, message) {
        if (result === undefined || result === null) return;

        if (typeof result === "string" || typeof result === "number") {
            await this.sendMessage(message.chat.id, String(result));
        } else if (typeof result === "object" && result.type) {
            await this.handleTypedResult(result, message);
        }
    }

    async handleEventResult(result, message, eventName) {
        if (result === undefined || result === null) return;

        try {
            this.log.debug(`Auto-handling result for event ${eventName}, result type: ${typeof result}`);

            if (typeof result === "string" || typeof result === "number") {
                await this.sendMessage(message.chat.id, String(result));
            } else if (typeof result === "object" && result.type) {
                await this.handleTypedResult(result, message);
            } else if (typeof result === "object") {
                // If result is an object without type, try to send as string
                await this.sendMessage(message.chat.id, JSON.stringify(result, null, 2));
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
        this.log.info(`Plugin started`);
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

        this.log.info(`Plugin stopped`);
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
            PROXY: 0x02
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

    // Bot API methods - these should be injected by PluginManager
    async sendMessage(chatId, text, options = {}) {
        if (this.bot && this.bot.sendMessage) {
            return await this.bot.sendMessage(chatId, text, options);
        }
        throw new Error('Bot sendMessage method not available');
    }

    async sendPhoto(chatId, photo, options = {}) {
        if (this.bot && this.bot.sendPhoto) {
            return await this.bot.sendPhoto(chatId, photo, options);
        }
        throw new Error('Bot sendPhoto method not available');
    }

    async sendDocument(chatId, document, options = {}) {
        if (this.bot && this.bot.sendDocument) {
            return await this.bot.sendDocument(chatId, document, options);
        }
        throw new Error('Bot sendDocument method not available');
    }

    async sendAudio(chatId, audio, options = {}) {
        if (this.bot && this.bot.sendAudio) {
            return await this.bot.sendAudio(chatId, audio, options);
        }
        throw new Error('Bot sendAudio method not available');
    }

    async sendVideo(chatId, video, options = {}) {
        if (this.bot && this.bot.sendVideo) {
            return await this.bot.sendVideo(chatId, video, options);
        }
        throw new Error('Bot sendVideo method not available');
    }

    async sendVoice(chatId, voice, options = {}) {
        if (this.bot && this.bot.sendVoice) {
            return await this.bot.sendVoice(chatId, voice, options);
        }
        throw new Error('Bot sendVoice method not available');
    }

    async sendSticker(chatId, sticker, options = {}) {
        if (this.bot && this.bot.sendSticker) {
            return await this.bot.sendSticker(chatId, sticker, options);
        }
        throw new Error('Bot sendSticker method not available');
    }

    async sendChatAction(chatId, action, options = {}) {
        if (this.bot && this.bot.sendChatAction) {
            return await this.bot.sendChatAction(chatId, action, options);
        }
        throw new Error('Bot sendChatAction method not available');
    }
}