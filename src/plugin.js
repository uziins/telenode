/**
 * @typedef {Object} Handlers
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

module.exports = class Plugin {
    constructor() {
        this._handlers = {};
    }

    /**
     * @type {Handlers}
     */
    static get handlers() {
        return {
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

}