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
        this._forwarded = [];
        this._forwardedMessage = {
            id: '',
            sender: this.BC.MT.copyObject(this._sender),
            chat: this.BC.MT.copyObject(this._chat),
            date: 0,
        };
        this.id = '';
        this.text = '';
        this.date = 0;
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
        this._setPrivate('chat', value);
    }

    get sender () {
        return this._sender;
    }

    set sender (value) {
        this._setPrivate('sender', value);
    }

    get reply () {
        return this._reply;
    }

    set reply (value) {
        this._setPrivate('reply', value);
    }

    get forwarded () {
        return this._forwarded;
    }

    handleForwarded (data = {}) {
        let messages = this.BC.MT.makeArray(data);
        for (let message of messages) {
            let forwarded = this.BC.MT.copyObject(this._forwardedMessage);
            this._forwarded.push(this.BC.MT.mergeRecursive(forwarded, message));
        }
    }

    get forwardedBlank () {
        return this.BC.MT.copyObject(this._forwardedMessage);
    }

    _setPrivate (property, value) {
        property = '_' + property;
        for (const key in value) {
            if (value.hasOwnProperty(key) && this[property].hasOwnProperty(key)) {
                this[property][key] = value[key];
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