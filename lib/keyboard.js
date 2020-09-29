const Context = require('./context')

/**
 * @typedef {Object} kbObject
 * @property {string[]|Array.string[]} [buttons]
 * @property {string[]} [options]
 * @property {string} [method]
 * @property {string} [language]
 * @property {string} [bridge]
 * @property {boolean} [clear]
 */

/**
 * Keyboard builder
 * @class
 * @property {BotCMS} BC
 * @property {BotCMS.Context} ctx
 * @property {string[]} options
 * @property {string} bridge
 * @property {string[]|Array.string[]}
 */
class Keyboard {
    /**
     * @constructor
     * @param {import(Context|import('./botcms.js')} ctx
     * @param {kbObject} [kbObject]
     */
    constructor (ctx, kbObject) {
        // console.log('KB. CTX INSTANCE OF BOTCMS? ', ctx instanceof BotCMS);
        if (ctx instanceof Context) {
            this.BC = ctx.BC
            this.ctx = ctx
            this._language = ctx.language
        } else {
            this.BC = ctx
            this.ctx = undefined
            this._language = this.BC.config.language
        }
        this._options = ['simple', /*'resize',*/ 'extra'];
        this._buttons = [];
        this._bridge = '';
        this._clear = false;

        /**
         * Add buttons row
         * @function
         * @param {string[]} captions Array of lexicon entries keys
         * @returns {Keyboard}
         */
        this.addBtnRow = (captions) => {
            if (!Array.isArray(captions)) {
                captions = [ captions ];
            }
            let translated = [];
            for (let caption of captions) {
                translated.push(this.BC.lexicon(caption, {}, this._language, this.ctx));
            }
            this._buttons.push(translated);
            return this;
        }

        /**
         * Add one custom button
         * @function
         * @param {string} caption Key of lexicon entry
         * @returns {Keyboard}
         */
        this.addBtn = (caption) => {
            return this.addBtnRow([caption]);
        }

        /**
         * Add main menu button
         * @function
         * @returns {Keyboard}
         */
        this.addBtnMenuMain = () => {
            return this.addBtnRow(['common.btn.menu.main']);
        }

        /**
         * Add manage menu button
         * @function
         * @returns {Keyboard}
         */
        this.addBtnMenuManage = () => {
            return this.addBtnRow(['common.btn.menu.manage']);
        }

        /**
         * Add back button
         * @function
         * @returns {Keyboard}
         */
        this.addBtnBack = () => {
            return this.addBtnRow(['common.btn.menu.back']);
        }

        /**
         * Add remove button
         * @function
         * @returns {Keyboard}
         */
        this.addBtnDel = () => {
            return this.addBtnRow(['common.btn.action.remove']);
        }

        /**
         * Add buttons from array
         * @function
         * @param kbArray
         * @returns {Keyboard}
         */
        this.addBtnFromArray = (kbArray = []) => {
            for (let row of kbArray) {
                this.addBtnRow(row);
            }
            return this;
        }

        /**
         * Load all kb properties from Object
         * @function
         * @param {kbObject} kbObject
         * @returns {Keyboard}
         */
        this.fromKBObject = (kbObject = {}) => {
            if (kbObject.method !== undefined) {
                let method = this.BC.MT.extract(kbObject.method);
                if (method) {
                    kbObject = this.BC.MT.merge(method(this.ctx), kbObject);
                }
            }
            if (Array.isArray(kbObject.buttons)) {
                this.addBtnFromArray(kbObject.buttons);
            }
            if (Array.isArray(kbObject.options)) {
                this._options = kbObject.options;
            }
            if (typeof kbObject.language === 'string') {
                this._language = kbObject.language;
            }
            if (typeof kbObject.bridge === 'string') {
                this.bridge = kbObject.bridge;
            }
            if (kbObject.clear === true) {
                this._clear = true;
            }
            return this;
        }

        /**
         * Set clear flag
         * @function
         * @param clear
         * @returns {Keyboard}
         */
        this.clear = (clear = true) => {
            this._clear = clear;
            return this;
        }

        /**
         * Build bridge-specific keyboard object
         * @function
         * @returns {[]|any|*[]}
         */
        this.build = () => {
            let bridge = this.ctx ? this.ctx.Bridge : this.BC.bridges[this.bridge]
            return typeof bridge === 'object'
              ? (this._clear ? bridge.kbRemove() : bridge.kbBuild({ buttons: this.buttons, options: this.options, }))
              : []
        }

        if (kbObject) {
            if (this.BC.MT.isString(kbObject)) {
                kbObject = this.BC.keyboards[kbObject];
            }
            this.fromKBObject(kbObject);
        }
    }

    get options () {
        return this._options;
    }

    set options (options) {
        this._options = options;
    }

    get bridge () {
        return this._bridge
    }

    set bridge (name) {
        this._bridge = name
    }

    get buttons () {
        return this._buttons;
    }

    set buttons (buttons) {
        this._buttons = buttons;
    }
}

module.exports = Keyboard;