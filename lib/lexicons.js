/**
 * Class for users lexicons
 *
 * @property {Object} __lexicons
 * @property {import('./botcms.js)} BC
 * @property {import('./tools.js)} T
 * @property {import('./botcms.js).MVTools} MT
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

    async process (key, params = {}, language = '', ctx = undefined) {
        if (this.MT.empty(language)) {
            language = this.BC.config.language;
        }
        let result = [];
        let options = {};
        let entries = this.MT.makeArray(key);
        for (let string of entries) {
            if (!this.MT.empty(string)) {
                if (typeof string === 'object') {
                    if ('data' in string) {
                        options = string
                    } else {
                        options = this.MT.merge(options, string);
                    }
                    if (Object.keys(params).length === 0 && typeof string.params === 'object') {
                        params = string.params
                    }
                }

                string = await this.T.execMessage(string, ctx, params);
                // console.log('LEXICON. STRING AFTER EXEC MESSAGE', string)
                let entry = this.extract(string, language) // this.MT.extract(language + '.' + string, this.__lexicons);
                if (this.MT.empty(entry) && language !== this.BC.config.language) {
                    entry = this.extract(string, this.BC.config.language) //this.MT.extract(this.BC.config.language + '.' + string, this.__lexicons);
                }
                if (!this.MT.empty(entry)) {
                    string = entry;
                }

                if (typeof string === 'object') {
                    options = this.MT.merge(options, string);
                    string = string.text;
                }
                string = this.parse(string, params);
            } else {
                string = '';
            }
            result.push(string);
        }
        return this.MT.empty(options) ? result.join("\n") : this.MT.merge(options, {text: result.join("\n")});
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

    extract (path, lang = null) {
        if (lang !== null) {
            path = lang + '.' + path;
        }
        return this.MT.extract(path, this.__lexicons);
    }

}

module.exports = Lexicons;
module.exports.defaults = Lexicons;