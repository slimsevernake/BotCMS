/**
 * Class for users lexicons
 *
 * @property {Object} __lexicons
 * @property {Tools} T
 * @property {MVTools} MT
 *
 */


class Lexicons {

    LEFT = '((';
    RIGHT = '))';

    __lexicons = {};
    T;
    MT;

    constructor (BC) {
        this.BC = BC;
        this.T = this.BC.T;
        this.MT = this.BC.MT;
    }

    load (lexicons) {
        this.__lexicons = this.MT.mergeRecursive(this.__lexicons, lexicons);
    }

    process (key, params = {}, language = '', ctx = undefined) {
        if (this.MT.empty(language)) {
            language = this.BC.config.language;
        }
        let result = key;
        let entry = this.MT.extract(language + '.' + key, this.__lexicons);
        if (!this.MT.empty(entry)) {
            result = this.parse(entry, params);
            // console.log(' RESULT OF ENTRY ' + result, params);
        } else {
            let bind = this.MT.checkBinding(key, this.BC.BINDINGS.METHOD);
            if (bind.found) {
                result = this.T.execMessage(bind.clear, ctx);
                if (!this.MT.empty(entry)) {
                    result = entry;
                    // console.log(' RESULT OF METHOD ' + result);
                }
            }
        }
        return result;
    }

    parse (entry, params) {
        if (this.BC.Templater) {
            entry = this.BC.Templater.render(entry, params, [this.LEFT, this.RIGHT]);
        } else {
            for (let key in params) {
                if (params.hasOwnProperty(key)) {
                    entry = this.MT.replaceAll(this.LEFT + key + this.RIGHT, params[key], entry);
                }
            }
        }
        return entry;
    }

}

module.exports = Lexicons;
module.exports.defaults = Lexicons;