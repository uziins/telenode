const Model = require("letsql");

class Users extends Model {
    constructor() {
        super();

        this.table = "users";
        this.fillable = [
            "id",
            "first_name",
            "last_name",
            "username",
            "is_bot",
            "is_blocked",
        ];

        this.casts = {
            is_bot: "boolean",
            is_blocked: "boolean",
        };
    }
}

module.exports = Users;