import Authorizations from "../models/authorizations.js";
import config from "../config.js"

export default class Auth {
    constructor() {
        this.authorizations = new Authorizations();
        this.root = config.BOT_SUDOERS;
        this.admin = [];

        this.init().then(r => {
            console.log("Auth initialized");
        });
    }

    async init() {
        const admin = await this.authorizations.select("user_id", "chat_id").where("role", "admin").get();
        this.admin = admin.map(a => {
            return {
                user_id: a.user_id,
                chat_id: a.chat_id
            };
        });
    }

    async addAdmin(user_id, chat_id) {
        if (await this.authorizations.addAdmin(user_id, chat_id)) {
            if (!this.admin.some(a => a.user_id === user_id && a.chat_id === chat_id)) {
                this.admin.push({user_id, chat_id});
            }
        }
    }

    async removeAdmin(user_id, chat_id) {
        await this.authorizations.where({user_id, chat_id}).delete();
        this.admin = this.admin.filter(a => a.user_id !== user_id && a.chat_id !== chat_id);
    }

    isRoot(user_id) {
        return this.root.includes(user_id);
    }

    isAdmin(user_id, chat_id) {
        return this.admin.some(a => a.user_id === user_id && a.chat_id === chat_id);
    }
}