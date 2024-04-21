import Model from "letsql";

class Plugins extends Model {
    constructor() {
        super();

        this.table = "plugins";
        this.softDelete = true;
        this.fillable = ["plugin_name", "name", "description", "help", "is_visible", "is_active", "deleted_at"];
        this.casts = {
            is_visible: "boolean",
            is_active: "boolean"
        };
    }

    async getPlugin(name) {
        let row = await this.select().where("plugin_name", name).withTrashed().first();
        if (row) {
            if (row.deleted_at) {
                await this.where("plugin_name", name).withTrashed().update({deleted_at: null, is_active: false});
            }
        } else {
            await this.insert({plugin_name: name, is_active: false});
            row = await this.select().where("plugin_name", name).first();
        }
        return row;
    }

    async deletePlugin(name) {
        // if name is array, delete all plugins that are not in the array
        if (Array.isArray(name)) {
            return this.whereNotIn("plugin_name", name).delete();
        } else {
            return this.where("plugin_name", name).delete();
        }
    }
}

export default Plugins;