/** Parcel from bot to user
 * @class
 *
 * @property {Object<string, []>} keyboard
 * @property {string} message
 * @property {string|int} peerId
 * @property {Object<string, Object<string, string>|string>} attachments
 * @property {string|int} replyMsgId
 * @property {string|int} fwdMsgId
 * @property {string[]|int[]} fwdMsgIds
 */

class Parcel {
    constructor (content) {

        this.keyboard = {
            buttons: [],
            options: [],
        };
        this.message = '';
        this.peerId = '';
        this.attachments = {};
        this.replyMsgId = 0;
        this.fwMsgIds = [];
        this.fwChatId = 0;

        switch (typeof content) {
            case 'string' :
                this.message = content;
                break;

            case 'object':
                for (let key in content) {
                    if (content.hasOwnProperty(key)) {
                        this[key] = content[key];
                    }
                }
                break;
        }

    }


}

module.exports = Parcel;
module.exports.default = Parcel;