/** Class for user scripts
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Scripts {

    gotos = [
        'goto',
        'validate.failure',
        'validate.success',
        'validate.switch',
    ];

    constructor (BC) {
        this._scripts = {};

        this.BC = BC;
        this.T = BC.T;
        this.MT = BC.MT;
    }

    load (scripts) {
        if (!this.MT.empty(scripts)) {
            scripts = this.prepareScripts('', scripts);
            this._scripts = this.BC.MT.mergeRecursive(this._scripts, scripts);
        }
    }

    prepareScripts (parent, script, additional = {}) {
        for (const name in script) {
            if (!script.hasOwnProperty(name)) {
                continue;
            }

            const grandpa = additional.grandpa || '';
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

                let replaceGoto = {'((self))': path, '((path))': path, '((parent))': parent, '((grandpa))': grandpa, '((children))': children};
                for (let goto of this.gotos) {
                    let value = this.MT.extract(goto, script[name]);
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE BEFORE: ', value);
                    if (!this.MT.empty(value)) {
                        // console.log('GOTO: ' + goto + ' VALUE: ', value);
                        let replaced = this.MT.replaceRecursive(replaceGoto, value);
                        // console.log('GOTO: ' + goto + ' REPLACED: ', replaced);
                        script[name] = this.MT.setByPath(goto, script[name], replaced);
                    }
                    // console.log('SCRIPTS PREPARE SCRIPTS. NAME: ' + name + ' GOTO: ' + goto + ' VALUE AFTER: ', value);
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