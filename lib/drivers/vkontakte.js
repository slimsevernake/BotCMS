// import VK from 'vk-io';
const { VK, Keyboard } = require('vk-io');
const { SessionManager } = require('@vk-io/session');

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
        // console.log('TG: ');
        // console.log(params);
        this.transport = new VK(params);

        this.transport.updates.on('message', (new sessionHandler(sessionParams)).middleware);
    }

    isAvailable () {
        return typeof this.transport === 'object';
    }

    loadSchema (schema) {
        this.schema = schema;
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
            bridge: t,
            bw: t.BC,
            message: {
                type: ctx.type === 'message' ? 'text' : ctx.type,
                text: ctx.text,
                attachments: ctx.payload.attachments || [],
                message_id: ctx.id,
                from: {
                    id: ctx.senderId
                },
                chat: {
                    id: ctx.peerId
                }
            },
            match: () => {},
            reply: (ctx, sendObject) => this.reply(ctx, sendObject),
            session: ctx.session,
        };

        let bcContext = new this.BC.classes.Context(params);
        return t.BC.handleUpdate(bcContext);
    }

    listen () {
        this.transport.updates.on('message', (ctx) => {return this.defaultCallback(this, ctx)});
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
        return this.transport.api.messages.send(sendObject);
    }

    start (middleware, ...middlewares) {
        this.transport.updates.hear('/start', middleware, ...middlewares);
    }

    help (middleware, ...middlewares) {
        this.transport.updates.hear('/help', middleware, ...middlewares);
    }

    on (updateType, middleware, ...middlewares) {
        this.transport.on(updateType, middleware, ...middlewares);
    }

    command (command, middleware, ...middlewares) {
        this.hear('/' + command, middleware, ...middlewares);
    }

    hear (trigger, middleware, ...middlewares) {
        // console.log('VK.updates.hear. TRIGGER: ' + trigger);
        this.transport.updates.hear(trigger, middleware, ...middlewares);
    }

    launch(middleware, ...middlewares) {
        this.transport.updates.start().catch(console.error);
        // this.transport.updates.startPolling();
        console.log('VK started');
    }
}


//     vk.updates.hear(/hello/i, context => (
//     context.send('World!')
// ));


module.exports = Object.assign(VKontakte, {VK});
module.exports.default = Object.assign(VKontakte, {VK});