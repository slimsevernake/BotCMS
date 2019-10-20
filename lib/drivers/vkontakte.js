const { VK, Keyboard } = require('vk-io');
const { SessionManager } = require('@vk-io/session');
const { fs } = require('fs');
const { _ } = require('lodash');

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
        this.ATTACHMENTS = {
            photo: this.BC.ATTACHMENTS.PHOTO,
            video: this.BC.ATTACHMENTS.VIDEO,
            audio: this.BC.ATTACHMENTS.AUDIO,
            wall: this.BC.ATTACHMENTS.POST,
            doc: this.BC.ATTACHMENTS.FILE,
            poll: this.BC.ATTACHMENTS.POLL,
        };
        this.ATTACHMENTS_FLIP = this.BC.T.flipObject(this.ATTACHMENTS);
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
        // console.log(ctx);
        // console.log(ctx.payload);

        /** @type {Context} **/
        let bcContext = new this.BC.classes.Context(this.BC, this, ctx);

        let chatType = '';
        switch (ctx.peerType) {
            case 'user':
                chatType = 'user';
                break;
            case 'chat':
                chatType = 'chat';
                break;
        }
        bcContext.Message.chat = {
            id: ctx.peerId,
            type: chatType,
        };
        bcContext.Message.sender = {
            id: ctx.senderId,
            isBot: ctx.senderType !== 'user',
        };
        bcContext.Message.id = ctx.id;
        bcContext.Message.date = ctx.createdAt;
        bcContext.Message.text = ctx.text || '';

        if (!this.BC.T.empty(ctx.replyMessage)) {
            bcContext.Message.reply = {
                id: ctx.replyMessage.id,
                text: ctx.replyMessage.text,
                chatId: ctx.replyMessage.peerId,
                senderId: ctx.replyMessage.senderId,
            }
        }


        if (!this.BC.T.empty(ctx.attachments)) {
            for (const attachment of ctx.attachments) {

                let props = {
                    type: attachment.type,
                    owner: attachment.ownerId,
                    name: String(attachment),
                };

                if (attachment.type === 'photo') {
                    let sizes = {};

                    for (const size of attachment.sizes) {
                        sizes[size.type] = size;
                    }
                    console.log(sizes);
                    let photo = sizes.w || sizes.z || sizes.y;
                    props.height = photo.height;
                    props.wigth = photo.width;
                    props.link = photo.url;
                    props.type = this.BC.ATTACHMENTS.PHOTO;
                }

                bcContext.Message.handleAttachment(props);
            }
        }

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

    async reply (ctx, Parcel) {
        console.log(Parcel);
        return ctx.send({
            message: Parcel.message,
            keyboard: Parcel.keyboard,
            attachment: await this.upload(Parcel.peerId, Parcel.attachments),
        }).then((message) => console.log(message));
    }

    send (Parcel) {
        return this.Transport.api.messages.send({
            message: Parcel.message,
            peer_id: Parcel.peerId,
            keyboard: Parcel.keyboard,
        }).then(message => this.defaultCallback(this, {update: {message: message}}, true));
    }

    async upload (peerId, attachments) {
        let result = '';
        if (!this.BC.T.empty(attachments)) {
            for (let type in attachments) {
                if (!attachments.hasOwnProperty(type)) {
                    continue;
                }
                for (let file of attachments[type]) {
                    let filename = file.split('/').reverse()[0];
                    await this.Transport.upload.messageDocument({
                        source: {
                            values: {
                                value: file,
                                filename: filename,
                            }
                        },
                        peer_id: peerId,
                        filename: filename,
                    }).then(response => {
                        console.log(response);
                        result = result + this.ATTACHMENTS_FLIP[type] + response.ownerId + '_' + response.id + ','
                    });
                }
            }
        }
        return result;
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