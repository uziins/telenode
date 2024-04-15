import Model from "letsql";

class Plugins extends Model {
    constructor() {
        super();

        this.table = "plugins";
        this.fillable = ["name", "description", "is_active"];
        this.casts = {
            is_active: "boolean"
        };
    }

    async getPlugin(name) {
        let row = await this.select().where("name", name).first();
        if (!row) {
            await this.insert({name, is_active: false});
            row = await this.select().where("name", name).first();
        }
        return row;
    }
}

export default Plugins;