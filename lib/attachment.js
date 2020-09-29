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

    /**
     * Set meta properties of attachment
     * @function
     * @param meta
     */
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