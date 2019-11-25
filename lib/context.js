/** Class for Inbound message context
 * @class
 *
 * @property {Object} context
 * @property {Message} Message
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

        this.Message = new this.BC.classes.Message(BC);
        this.session = context.session || {};

        this._processed = false;
    }

    reply (sendObject) {
        return this.Bridge.reply(this.context, sendObject)
    }

    get isProcessed () {
        return this._processed;
    }

    setProcessed (val) {
        this._processed = val;
    }

}

module.exports = Context;
module.exports.default = Context;