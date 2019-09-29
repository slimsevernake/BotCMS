const { VK, Keyboard } = require('vk-io');
const { SessionManager } = require('@vk-io/session');

/** VK driver
 * @class
 *
 * @property {Object} defaults
 * @property {string} driverName
 * @property {string} name
 *
 * @property {BotCMS} BC
 * @property {VK} Transport
 */

class VKontakte {
    constructor (BC, params = {}) {
        this.BC = BC;
        this.defaults = {
            name: 'vk',
            driverName: 'vk',
            sessionHandler: SessionManager,
        };
        this.name = params.name || this.defaults.name;
        this.driverName = params.driverName || this.defaults.driverName;
        let sessionHandler = params.sessionHandler || this.defaults.sessionHandler;
        let sessionParams = params.sessionParams || {};
        sessionParams.getStorageKey = sessionParams.getStorageKey || (context => (String(context.peerId) + ':' + String(context.senderId)));
        // console.log('TG: ');
        // console.log(params);
        this.Transport = new VK(params);

        this.Transport.updates.on('message', (new sessionHandler(sessionParams)).middleware);
    }

    isAvailable () {
        return typeof this.Transport === 'object';
    }

    defaultCallback (t, ctx) {
        if (ctx.payload.out === 1) {
            return;
        }
        console.log(ctx);
        console.log(ctx.payload);
        // for (let key in ctx) {
        //     // if (key.startsWith('is')) {
        //         console.log('DEFAULT CB. VK. ' + key + ' : ' + ctx[key]);
        //     // }
        // }
        const params = {
            context: ctx,
            Bridge: t,
            BC: t.BC,
            message: {
                type: ctx.type === 'message' ? 'text' : ctx.type,
                attachments: ctx.payload.attachments || [],
            },
        };

        let bcContext = new this.BC.classes.Context(this.BC, this, ctx);

        bcContext.message.chat.id = ctx.peerId;
        bcContext.message.from.id = ctx.senderId;
        bcContext.message.id = ctx.id;
        bcContext.message.text = ctx.text;

        return t.BC.handleUpdate(bcContext);
    }

    listen () {
        this.Transport.updates.on('message', (ctx) => {return this.defaultCallback(this, ctx)});
    }

    kbBuild (keyboard, recursive = false) {
        // console.log(keyboard.buttons);
        let kb = [];
        if (keyboard.options.indexOf('simple') > -1) {
            for (let key in keyboard.buttons) {
                if (!keyboard.buttons.hasOwnProperty(key)) {
                    continue;
                }
                if (Array.isArray(keyboard.buttons[key])) {
                    kb[key] = this.kbBuild({
                        buttons: keyboard.buttons[key],
                        options: keyboard.options
                    }, true);
                } else {
                    kb[key] = Keyboard.textButton({
                        label: keyboard.buttons[key],
                        payload: {
                            command: keyboard.buttons[key]
                        }
                    });
                }
            }
            // let kb = Markup.keyboard(keyboard.buttons);
            //
            // // console.log(kb.removeKeyboard);
            // // kb = kb.removeKeyboard();
            //
            // for (let option of keyboard.options) {
            //     console.log('[TG] BUILD KB. OPTION: ' + option + ', kb[option]: ', kb[option]);
            //     if (!this.BC.T.empty(kb[option])) {
            //         console.log('[TG] BUILD KB. OPTION FOUND: ' + option);
            //         kb = kb[option]();
            //     }
            // }
            // return kb;
        }
        if (!recursive) {
            kb = Keyboard.keyboard(kb);
            if (keyboard.options.indexOf('oneTime') > -1) {
                kb = kb.oneTime(true);
            }
        }
        console.log(kb);
        return kb;
    }

    kbRemove (ctx) {
        console.log('[VK] KB REMOVE');
        return [];
    }

    reply (ctx, sendObject) {
        console.log(sendObject);
        return ctx.send(sendObject);
    }

    send (sendObject) {
        return this.Transport.api.messages.send(sendObject);
    }

    start (middleware, ...middlewares) {
        this.Transport.updates.hear('/start', middleware, ...middlewares);
    }

    help (middleware, ...middlewares) {
        this.Transport.updates.hear('/help', middleware, ...middlewares);
    }

    on (updateType, middleware, ...middlewares) {
        this.Transport.on(updateType, middleware, ...middlewares);
    }

    command (command, middleware, ...middlewares) {
        this.hear('/' + command, middleware, ...middlewares);
    }

    hear (trigger, middleware, ...middlewares) {
        // console.log('VK.updates.hear. TRIGGER: ' + trigger);
        this.Transport.updates.hear(trigger, middleware, ...middlewares);
    }

    launch(middleware, ...middlewares) {
        this.Transport.updates.start().catch(console.error);
        // this.Transport.updates.startPolling();
        console.log('VK started');
    }
}


//     vk.updates.hear(/hello/i, context => (
//     context.send('World!')
// ));


module.exports = Object.assign(VKontakte, {VK});
module.exports.default = Object.assign(VKontakte, {VK});