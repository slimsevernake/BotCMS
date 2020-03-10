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

        this.Message = new this.BC.config.classes.Message(BC);
        this.session = context.session || {};
        this.singleSession = {};

        this._processed = false;
    }

    reply (Parcel) {
        if (this.BC.MT.isString(Parcel)) {
            Parcel = new this.BC.config.classes.Parcel(Parcel);
        }
        Parcel.peerId = this.Message.chat.id;
        return this.Bridge.reply(this.context, Parcel)
    }

    get isProcessed () {
        return this._processed;
    }

    get msg () {
        return this.Message.text || '';
    }

    setProcessed (val) {
        this._processed = val;
    }

    get language () {
        return this.session.language || this.BC.config.language;
    }

    set language (value) {
        this.session.language = value;
    }

    lexicon (key, params = {}) {
        return this.BC.Lexicons.process(key, params, this.language, this);
    }

    lexiconExtract (key) {
        return this.BC.Lexicons.extract(this.language + '.' + key);
    }

}

module.exports = Context;
module.exports.default = Context;