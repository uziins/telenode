import Model from "letsql";

export default class Authorizations extends Model {
    constructor() {
        super();

        this.table = "authorizations";
        this.softDelete = false;
        this.fillable = ["user_id", "chat_id", "role", "granted_by", "granted_at", "note"];
    }

    async getRole(user_id, chat_id) {
        return await this.select("role").where({user_id, chat_id}).first();
    }

    async addAdmin(user_id, chat_id) {
        const role = await this.getRole(user_id, chat_id);
        if (role) {
            await this.where({user_id, chat_id}).update({role: "admin"});
        } else {
            await this.insertIgnore({user_id, chat_id, role: "admin"});
        }
        return true;
    }

    async removeAdmin(user_id, chat_id) {
        return await this.where({user_id, chat_id}).delete();
    }
}