/** Class for Inbound message context
 * @class
 *
 * @property {Object} context
 * @property {Object} message
 * @property {Object} message.attachments
 * @property {Array} message.attachments.audio
 * @property {Array} message.attachments.file
 * @property {Array} message.attachments.photo
 * @property {Array} message.attachments.video
 * @property {Object} message.from
 * @property {Object} message.chat
 * @property {(int|string)} message.id
 * @property {string} message.text
 * @property {Object} session
 *
 * @property {Function} reply
 *
 * @property {Object} Bridge
 * @property {BotCMS} BC
 */

class Context {
    constructor (BC, Bridge, context) {

        this.BC = BC;
        this.Bridge = Bridge;
        this.context = context;

        this.message = {
            attachments: {},
            chat: {
                id: '',
                type: 'user',
            },
            from: {
                id: '',
                isBot: true,
                username: '',
            },
            id: '',
            reply_id: '',
            text: '',
        };
        for (const key in this.BC.ATTACHMENTS) {
            if (this.BC.ATTACHMENTS.hasOwnProperty(key)) {
                this.message.attachments[ this.BC.ATTACHMENTS[key] ] = [];
            }
        }
        this.session = context.session || {};
    }

    handleAttachment (props) {

        if (this.message.attachments.hasOwnProperty(props.type)) {
            let attachment = new this.BC.classes.Attachment(props);
            attachment.setMeta(props);
            this.message.attachments[props.type].push(attachment);
        }
    }

    reply (ctx, sendObject) {
        return this.Bridge.reply(ctx, sendObject)
    }

}

module.exports = Context;
module.exports.default = Context;