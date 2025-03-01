import Plugin from "./../../src/plugin.js";

class Echo extends Plugin {
    static get plugin() {
        return {
            name: "Echo",
            description: "Totally not a bot with an echo",
            help: "`/echo Lorem Ipsum` - Repeats whatever you type",
            visibility: Plugin.VISIBILITY.USER,
            version: "1.0.0",
            author: "TeleNode"
        };
    }

    get commands() {
        return {
            echo: ({args}) => args.join(" ") || "Nothing to echo"
        };
    }
}

export default Echo;