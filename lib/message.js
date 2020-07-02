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

    EVENTS = {
        MESSAGE_NEW: 'messageNew',
        MESSAGE_EDIT: 'messageEdit',
        MESSAGE_REMOVE: 'messageRemove',
        CHAT_NEW: 'chatNew',
        CHAT_MEMBER_NEW: 'chatMemberNew',
        CHAT_MEMBER_LEFT: 'chatMemberLeft',
        CHAT_MESSAGE_NEW: 'chatMessageNew',
        CHAT_MESSAGE_EDIT: 'chatMessageEdit',
        CHAT_MESSAGE_PIN: 'chatMessagePin',
        CHAT_PHOTO_NEW: 'chatPhotoNew',
        CHAT_PHOTO_REMOVE: 'chatPhotoRemove',
        CHAT_TITLE_NEW: 'chatTitleNew',
        RESULT_INLINE_CHOSEN: 'resultInlineChosen',
        QUERY_INLINE: 'queryInline',
        QUERY_CALLBACK: 'queryCallback',
        QUERY_SHIPPING: 'queryShipping',
        QUERY_PRE_CHECKOUT: 'queryPreCheckout',
        PAYMENT_NEW: 'paymentNew',
        PAYMENT_SUCCESS: 'paymentSuccess',
        POLL_NEW: 'pollNew',
        POLL_ANSWER: 'pollAnswer',
    };

    constructor (BC) {

        this.BC = BC;

        this.attachments = {};
        this._user = {
            id: '',
            isBot: false,
            username: '',
            fullname: '',
            firstName: '',
            secondName: '',
            lastName: '',
            accessHash: '',
        };
        this._chat = {
            id: '',
            type: 'user',
            accessHash: '',
        };
        this._sender = this.BC.MT.copyObject(this._user);
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
        this.event = '';
        this._users = [];
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

    handleUsers (data = {}) {
        let users = this.BC.MT.makeArray(data);
        for (let user of users) {
            this._users.push(this.fillUser(user));
        }
    }

    fillUser (values) {
        let user = this.BC.MT.copyObject(this._user);
        for (let key in values) {
            if (values.hasOwnProperty(key) && key in user && this.BC.MT.isScalar(values[key])) {
                user[key] = values[key];
            }
        }
        if (user.fullname === '') {
            user.fullname = [user.firstName.trim(), user.secondName.trim(), user.lastName.trim()].join(' ').replace('  ', ' ');
        }
        return user;
    }



}

module.exports = Message;
module.exports.default = Message;