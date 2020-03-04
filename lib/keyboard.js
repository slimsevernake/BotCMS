class Keyboard {
    constructor (ctx, kbObject) {
        this.ctx = ctx;
        this._options = ['simple', /*'resize',*/ 'extra'];
        this._buttons = [];
        this._clear = false;
        if (kbObject) {
            if (this.ctx.BC.MT.isString(kbObject)) {
                kbObject = this.ctx.BC.keyboards[kbObject];
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

    addBtnRow (captions) {
        if (!Array.isArray(captions)) {
            captions = [ captions ];
        }
        let translated = [];
        for (let caption of captions) {
            translated.push(this.ctx.lexicon(caption));
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
            let method = this.ctx.BC.MT.extract(kbObject.method);
            if (method) {
                kbObject = this.ctx.BC.MT.merge(method(this.ctx), kbObject);
            }
        }
        if (Array.isArray(kbObject.buttons)) {
            this.addBtnFromArray(kbObject.buttons);
        }
        if (Array.isArray(kbObject.options)) {
            this._options = kbObject.options;
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
        return this._clear ? this.ctx.Bridge.kbRemove() : this.ctx.Bridge.kbBuild({
            buttons: this.buttons,
            options: this.options,
        });
    }

    get buttons () {
        return this._buttons;
    }

    set buttons (buttons) {
        this._buttons = buttons;
    }
}

module.exports = Keyboard;