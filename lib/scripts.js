/** Class for user scripts
 * @class
 *
 * @private
 * @property {Object<string, *>} _scripts
 *
 * @property {import('./botcms.js)} BC
 * @property {BC.Tools} T
 * @property {BC.MVTools} MT
 */

class Scripts {

    /**
     * @constructor
     * @param {import('./botcms.js')} BC
     */
    constructor (BC) {
        this._scripts = {};

        this.BC = BC;
        this.T = BC.T;
        this.MT = BC.MT;

        this.gotos = [
            'goto',
            'validate',
        ];
    }

    /**
     * Merge new script with already loaded
     * @function
     * @param {Object} scripts
     */
    load (scripts) {
        if (!this.MT.empty(scripts)) {
            try {
                scripts = this.prepareScripts('', scripts);
                this._scripts = this.BC.MT.mergeRecursive(this._scripts, scripts);
            } catch (e) {
                console.log(e);
            }
        }
    }

    /**
     * Prepare script to load
     * @param {string} parent
     * @param {Object} script
     * @param {Object<string,string>} additional
     * @returns {Object}
     */
    prepareScripts (parent, script, additional = {}) {
        for (const name in script) {
            if (!script.hasOwnProperty(name)) {
                continue;
            }

            const grandpa = parent.lastIndexOf('.') !== -1 ? parent.substr(0, parent.lastIndexOf('.')) : '';
            const grandpa2 = grandpa.lastIndexOf('.') !== -1 ? grandpa.substr(0, grandpa.lastIndexOf('.')) : '';
            const grandpa3 = grandpa2.lastIndexOf('.') !== -1 ? grandpa2.substr(0, grandpa2.lastIndexOf('.')) : '';
            const path = this.MT.empty(parent) ? name : parent + '.' + name;
            const children = path + '.c';
            const isC = this.T.isChildrenPath(path);
            // console.log('LOAD SCRIPT FOR THREAD ' + path);
            if (isC) {
                additional.grandpa = parent;
                script[name] = this.prepareScripts(path, script[name], additional);
                break;
            } else {
                if (!this.MT.empty(script[name]['command'])) {
                    this.BC.commands.push(path);
                }
                for (const key in additional) {
                    if (additional.hasOwnProperty(key)) {
                        script[name][key] = additional[key];
                    }
                }
                script[name].parent = parent;
                script[name].path = path;
                script[name].children = children;
                script[name].isParent = !this.MT.empty(script[name]['c']);
                if (script[name].isParent) {
                    additional.grandpa = path;
                    script[name]['c'] = this.prepareScripts(path + '.c', script[name]['c'], additional);
                }

                let replaceGoto = {
                    '((self))': path,
                    '((path))': path,
                    '((p))': parent,
                    '((parent))': parent,
                    '((grandpa))': grandpa,
                    '((grandpa2))': grandpa2,
                    '((grandpa3))': grandpa3,
                    '((c))': children,
                    '((children))': children
                };
                for (let goto of this.gotos) {
                    let value = this.MT.extract(goto, script[name]);
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE BEFORE: ', value);
                    if (!this.MT.empty(value)) {
                        // console.log('GOTO: ' + goto + ' VALUE: ', value);
                        let replaced = this.MT.replaceRecursive(replaceGoto, value);
                        // console.log('GOTO: ' + goto + ' REPLACED: ', replaced);
                        script[name] = this.MT.setByPath(goto, script[name], replaced);
                    }
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE AFTER: ', script[name][goto]);
                }
            }
        }
        return script;
    }

    /**
     * Extract thread of scripts by path
     * @param {string} path
     * @returns {undefined|NodeJS.Process|NodeJS.Process}
     */
    extract (path) {
        return this.T.extract(path, this._scripts);
    }

}

module.exports = Scripts;
module.exports.defaults = Scripts;