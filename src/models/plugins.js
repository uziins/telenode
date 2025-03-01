import Model from "letsql";

import Plugin from "../plugin.js";

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

    async getPlugin(name, pluginDetail=null) {
        let row = await this.select().where("plugin_name", name).withTrashed().first();
        if (row) {
            let toUpdate = {}
            if (pluginDetail) {
                if (row.name !== pluginDetail.name) {
                    toUpdate.name = pluginDetail.name
                }
                if (row.description !== pluginDetail.description) {
                    toUpdate.description = pluginDetail.description
                }
                if (row.help !== pluginDetail.help) {
                    toUpdate.help = pluginDetail.help
                }

                if (row.is_visible !== (pluginDetail.visibility === Plugin.VISIBILITY.VISIBLE)) {
                    toUpdate.is_visible = pluginDetail.visibility === Plugin.VISIBILITY.VISIBLE
                }
            }
            if (row.deleted_at) {
                toUpdate.deleted_at = null
                toUpdate.is_active = false
            }

            if (Object.keys(toUpdate).length > 0) {
                await this.where("plugin_name", name).withTrashed().update(toUpdate);
            }
        } else {
            await this.insert({
                plugin_name: name,
                name: pluginDetail ? pluginDetail.name : name,
                description: pluginDetail ? pluginDetail.description : null,
                help: pluginDetail ? pluginDetail.help : null,
                is_visible: pluginDetail ? (pluginDetail.visibility === Plugin.VISIBILITY.VISIBLE) : false,
                is_active: false
            });
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