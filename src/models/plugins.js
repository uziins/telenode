import Model from "letsql";

import Plugin from "../plugin.js";

class Plugins extends Model {
    constructor() {
        super();

        this.table = "plugins";
        this.softDelete = true;
        this.fillable = ["identifier", "version", "name", "description", "help", "is_visible", "is_active", "deleted_at"];
        this.casts = {
            is_visible: "boolean",
            is_active: "boolean"
        };
    }

    async getPlugin(name, pluginDetail=null) {
        let row = await this.select().where("identifier", name).withTrashed().first();
        if (!row) {
            if (pluginDetail) {
                row = await this.upsertPlugin(name, pluginDetail);
            } else {
                return null;
            }
        }

        if (row.deleted_at) {
            return null; // Plugin is deleted
        }

        if (pluginDetail) {
            row.identifier = pluginDetail.identifier || row.identifier;
            row.version = pluginDetail.version || row.version;
            row.name = pluginDetail.name || row.name;
            row.description = pluginDetail.description || row.description;
            row.help = pluginDetail.help || row.help;
            row.is_visible = pluginDetail.visibility === Plugin.VISIBILITY.VISIBLE;
        }

        return row;
    }

    async upsertPlugin(identifier, pluginDetail=null) {
        let row = await this.select().where("identifier", identifier).withTrashed().first();
        if (row) {
            let toUpdate = {}
            if (pluginDetail) {
                if (row.version !== pluginDetail.version) {
                    toUpdate.version = pluginDetail.version;
                }
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
                await this.where("identifier", identifier).withTrashed().update(toUpdate);
            }
        } else {
            await this.insert({
                identifier: identifier,
                version: pluginDetail ? pluginDetail.version : "0.0.1",
                name: pluginDetail ? pluginDetail.name : identifier,
                description: pluginDetail ? pluginDetail.description : null,
                help: pluginDetail ? pluginDetail.help : null,
                is_visible: pluginDetail ? (pluginDetail.visibility === Plugin.VISIBILITY.VISIBLE) : false,
                is_active: false
            });
            row = await this.select().where("identifier", identifier).first();
        }
        return row;
    }

    async deletePlugin(name) {
        // if name is array, delete all plugins that are not in the array
        if (Array.isArray(name)) {
            return this.whereNotIn("identifier", name).delete();
        } else {
            return this.where("identifier", name).delete();
        }
    }
}

export default Plugins;