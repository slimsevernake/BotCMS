/** Class for user scripts
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Scripts {

    constructor (BC) {
        this._scripts = {};

        this.BC = BC;
        this.T = BC.T;
    }

    load (scripts) {
        if (!this.T.empty(scripts)) {
            this._scripts = this.loadScript('', scripts);
        }
    }

    loadScript (parent, script, additional = {}) {
        for (const name in script) {
            if (!script.hasOwnProperty(name)) {
                continue;
            }

            const path = this.T.empty(parent) ? name : parent + '.' + name;
            const isC = this.T.isChildrenPath(path);
            // console.log('LOAD SCRIPT FOR THREAD ' + path);
            if (isC) {
                script[name] = this.loadScript(path, script[name], additional);
                break;
            } else {
                const kbName = script[name]['keyboard_name'];
                if (kbName && this.BC.keyboards[kbName] !== undefined) {
                    script[name]['keyboard'] = this.BC.keyboards[kbName];
                }
                if (!this.T.empty(script[name]['command'])) {
                    this.BC.commands.push(path);
                }
                for (const key in additional) {
                    if (additional.hasOwnProperty(key)) {
                        script[name][key] = additional[key];
                    }
                }
                if (script[name].hasOwnProperty('store'))
                    script[name].parent = parent;
                script[name].path = path;
                script[name].isParent = !this.T.empty(script[name]['c']);
                if (script[name].isParent) {
                    script[name]['c'] = this.loadScript(path + '.c', script[name]['c'], additional);
                }
            }
        }
        return script;
    }

    extract (path) {
        return this.T.extract(path, this._scripts);
    }

}

module.exports = Scripts;
module.exports.defaults = Scripts;