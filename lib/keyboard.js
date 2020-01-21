class Keyboard {
    constructor (ctx) {
        this.ctx = ctx;
        this._options = ['simple', 'resize', 'extra'];
        this._buttons = [];
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

    addBtnMain () {
        return this.addBtn('btn.menu.main');
    }

    addBtnBack () {
        return this.addBtn('btn.menu.back');
    }

    addBtnDel () {
        return this.addBtn('btn.actions.remove');
    }

    fromArray (kbArray = []) {
        for (let row of kbArray) {
            this.addBtnRow(row);
        }
    }

    build () {
        return this.ctx.Bridge.kbBuild({
            buttons: this._buttons,
            options: this._options,
        });
    }

    get buttons () {
        return this._buttons;
    }
}

module.exports = Keyboard;