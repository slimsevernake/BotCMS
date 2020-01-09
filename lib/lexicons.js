/**
 * Class for users lexicons
 *
 * @property {Object} __lexicons
 * @property {Tools} T
 * @property {MVTools} MT
 *
 */


class Lexicons {

    __lexicons = {};
    T;
    MT;

    constructor (BC) {
        this.BC = BC;
        this.T = this.BC.T;
        this.MT = this.BC.MT;
    }

    load (lexicons) {
        if (!this.T.empty(lexicons)) {
            this.__lexicons = lexicons;
        }
    }

    process (key, params = [], language = '', ctx = undefined) {
        if (this.MT.empty(language)) {
            language = this.BC.config.language;
        }
        let result = key;
        let entry = this.MT.extract(language + '.' + key, this.__lexicons);
        let bind = this.MT.checkBinding(entry, this.BC.BINDINGS.METHOD);
        if (bind.found) {
            result = this.T.execMessage(bind.clear, ctx);
        } else if (!this.MT.empty(entry)) {
            result = entry;
        }
        return result;
    }

}

module.exports = Lexicons;
module.exports.defaults = Lexicons;