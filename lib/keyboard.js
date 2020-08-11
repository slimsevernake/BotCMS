const BotCMS = require('./botcms');

class Keyboard {
    constructor (ctx, kbObject) {
        // console.log('KB. CTX INSTANCE OF BOTCMS? ', ctx instanceof BotCMS);
        if (ctx instanceof BotCMS) {
            this.BC = ctx
            this.ctx = undefined
            this._language = this.BC.config.language
        } else {
            this.BC = ctx.BC
            this.ctx = ctx
            this._language = ctx.language
        }
        this._options = ['simple', /*'resize',*/ 'extra'];
        this._buttons = [];
        this._bridge = '';
        this._clear = false;
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

    addBtnRow (captions) {
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

    addBtn (caption) {
        return this.addBtnRow([caption]);
    }

    addBtnMenuMain () {
        return this.addBtnRow(['common.btn.menu.main']);
    }

    addBtnMenuManage () {
        return this.addBtnRow(['common.btn.menu.manage']);
    }

    addBtnBack () {
        return this.addBtnRow(['common.btn.menu.back']);
    }

    addBtnDel () {
        return this.addBtnRow(['common.btn.action.remove']);
    }

    addBtnFromArray (kbArray = []) {
        for (let row of kbArray) {
            this.addBtnRow(row);
        }
        return this;
    }

    fromKBObject (kbObject) {
        kbObject = kbObject || {};
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

    clear (clear = true) {
        this._clear = clear;
        return this;
    }

    build () {
        let bridge = this.ctx ? this.ctx.Bridge : this.BC.bridges[this.bridge]
        return typeof bridge === 'object'
          ? (this._clear ? bridge.kbRemove() : bridge.kbBuild({ buttons: this.buttons, options: this.options, }))
          : []
    }

    get buttons () {
        return this._buttons;
    }

    set buttons (buttons) {
        this._buttons = buttons;
    }
}

module.exports = Keyboard;