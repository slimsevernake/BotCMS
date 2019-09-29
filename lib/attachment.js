/** Class for user scripts
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Attachment {

    constructor (attachment) {
        this.type = attachment.type || null;
        this.id = attachment.id || '';
        this.link = attachment.link || '';
        this.name = attachment.name || '';
        this.owner = attachment.owner || '';
        this.meta = {
            width: 0,
            height: 0,
            length: 0,
            fileSize: 0,
        };
        this.setMeta(attachment);
    }

    setMeta (meta) {
        for (const key in meta) {
            if (meta.hasOwnProperty(key)) {
                this.meta[key] = meta[key];
            }
        }
    }

}

module.exports = Attachment;
module.exports.defaults = Attachment;