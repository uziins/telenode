import Plugin from "../../src/plugin.js";

export default class HelloPlugin extends Plugin {
    static get plugin() {
        return {
            name: "Hello",
            description: "Hello World!",
            help: "Hello World!"
        };
    }

    onMessage({message}) {
        console.log(message)
    }

    onText({message}) {
        // console.log(message)
        this.sendChatAction(message.chat.id, 'typing').then(r => this.sendMessage(message.chat.id, 'Hello!'))
        // setTimeout(() => {
        //     this.sendMessage(message.chat.id, 'Hello!')
        // }, 5000)
    }
}