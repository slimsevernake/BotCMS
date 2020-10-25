/** Class for message attachments
 * @class
 *
 * @property {string} type
 * @property {string|int} id
 * @property {string} link
 * @property {string} name
 * @property {string} owner
 * @property {Object<string, string|int>} meta
 */
class Attachment {

    constructor (attachment) {
        this.type = null;
        this.id = '';
        this.link = '';
        this.name = '';
        this.owner = '';
        this.meta = {
            width: 0,
            height: 0,
            length: 0,
            fileSize: 0,
            fileName: '',
            mimeType: '',
            performer: '',
            title: '',
            animated: false,
            emoji: '',
            groupName: ''
        };
        this.set(attachment);
    }

    set (key, value) {
        let obj = {}
        if (typeof key === 'string') {
            obj[key] = value
        } else if (typeof key === 'object') {
            obj = key
        }
        for (let key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key in this) {
                    this[key] = obj[key]
                } else if (key in this.meta) {
                    this.meta[key] = obj[key]
                }
            }
        }
    }

}

module.exports = Attachment;
module.exports.defaults = Attachment;