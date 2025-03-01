import Model from "letsql";

class Chats extends Model {
    constructor() {
        super();

        this.table = "chats";
        this.fillable = [
            "id",
            "type",
            "title",
            "username",
            "first_name",
            "last_name",
            "is_active",
            "is_blocked",
        ];

        this.casts = {
            is_blocked: "boolean",
        };
    }
}

export default Chats;