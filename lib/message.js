/** Class for Inbound message
 * @class
 *
 * @property {Object} attachments
 * @property {Object} from
 * @property {Object} chat
 * @property {(int|string)} id
 * @property {string} text
 *
 * @property {BotCMS} BC
 */

class Message {
    constructor (BC) {

        this.BC = BC;

        this.attachments = {};
        this._chat = {
            id: '',
            type: 'user',
        };
        this._sender = {
            id: '',
            isBot: false,
            username: '',
            fullname: '',
        };
        this._reply = {
            id: '',
            chatId: '',
            senderId: '',
            text: '',
        };
        this.id = '';
        this.text = '';
        this.edited = false;
        for (const key in this.BC.ATTACHMENTS) {
            if (this.BC.ATTACHMENTS.hasOwnProperty(key)) {
                this.attachments[ this.BC.ATTACHMENTS[key] ] = [];
            }
        }
    }

    get chat () {
        return this._chat;
    }

    set chat (value) {
        for (const key in value) {
            if (value.hasOwnProperty(key) && this._chat.hasOwnProperty(key)) {
                this._chat[key] = value[key];
            }
        }
    }

    get sender () {
        return this._sender;
    }

    set sender (value) {
        for (const key in value) {
            if (value.hasOwnProperty(key) && this._sender.hasOwnProperty(key)) {
                this._sender[key] = value[key];
            }
        }
    }
    get reply () {
        return this._reply;
    }

    set reply (value) {
        for (const key in value) {
            if (value.hasOwnProperty(key) && this._reply.hasOwnProperty(key)) {
                this._reply[key] = value[key];
            }
        }
    }

    handleAttachment (props) {
        if (this.attachments.hasOwnProperty(props.type)) {
            this.attachments[props.type].push(new this.BC.config.classes.Attachment(props));
        }
    }

}

module.exports = Message;
module.exports.default = Message;