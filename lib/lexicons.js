/**
 * Class for users lexicons
 *
 * @property {Object} __lexicons
 * @property {Tools} T
 * @property {MVTools} MT
 *
 */


class Lexicons {

    LEFT = '{{';
    RIGHT = '}}';

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
        let result = [];
        let entries = this.MT.makeArray(key);
        for (let string of entries) {
            if (string !== '') {
                string = this.T.execMessage(string, ctx);
                let entry = this.MT.extract(language + '.' + string, this.__lexicons);
                string = !this.MT.empty(entry) ? this.parse(entry, params) : this.parse(string, params);
            }
            result.push(string);
        }
        return result.join("\n");
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