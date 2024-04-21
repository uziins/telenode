import Plugin from "./../../src/plugin.js";

class Echo extends Plugin {
    static get plugin() {
        return {
            name: "Echo",
            description: "Totally not a bot with an echo",
            help: "`/echo Lorem Ipsum`"
        };
    }

    get commands() {
        return {
            echo: ({args}) => args.join(" ")
        };
    }
}

export default Echo;