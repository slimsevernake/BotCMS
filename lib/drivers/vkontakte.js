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
        this.MODES = {
            USER: 'user',
            GROUP: 'group',
        };
        this.BC = BC;
        this.defaults = {
            name: 'vk',
            driverName: 'vk',
            humanName: 'VKontakte',
            sessionHandler: SessionManager,
            authScope: 'notify,photos,friends,audio,video,notes,pages,docs,status,questions,offers,wall,groups,messages,notifications,stats,ads,offline',
        };
        this.params = params;
        this._mode = params.mode || this.MODES.GROUP;
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
        this.humanName = params.humanName || this.defaults.humanName;
        let sessionHandler = params.sessionHandler || this.defaults.sessionHandler;
        let sessionParams = params.sessionParams || {};
        sessionParams.getStorageKey = sessionParams.getStorageKey || (context => (String(context.peerId) + ':' + String(context.senderId)));
        params.authScope = params.authScope || this.defaults.authScope;
        // console.log('TG: ');
        // console.log(params);
        this.Transport = new VK(params);
        this.Transport.twoFactorHandler = params.twoFactorHandler;
        this.Transport.updates.on('message', (new sessionHandler(sessionParams)).middleware);
    }

    get mode () {
        return this._mode;
    }

    isAvailable () {
        return typeof this.Transport === 'object';
    }

    async defaultCallback (t, ctx) {
        // if (ctx.payload.out === 1) {
        //     return;
        // }
        await ctx.loadMessagePayload();
        // console.log(ctx);
        // console.log(ctx.payload);

        /** @type {Context} **/
        let bcContext = new this.BC.config.classes.Context(this.BC, this, ctx);

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
            id: ctx.payload.message.out === 1 ? this.BC.SELF_SEND : ctx.senderId,
            isBot: ctx.senderType !== 'user',
        };
        bcContext.Message.id = ctx.id;
        bcContext.Message.date = ctx.createdAt;
        bcContext.Message.text = ctx.text || '';

        if (ctx.hasReplyMessage) {
            bcContext.Message.reply = {
                id: ctx.replyMessage.id,
                text: ctx.replyMessage.text,
                chatId: ctx.replyMessage.peerId,
                senderId: ctx.replyMessage.senderId,
            }
        }


        if (!this.BC.MT.empty(ctx.attachments)) {
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
            //     if (!this.BC.MT.empty(kb[option])) {
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
        // console.log(Parcel);
        let sending = {
            message: Parcel.message,
            attachment: await this.upload(Parcel.peerId, Parcel.attachments),
        };
        if (this.mode === this.MODES.GROUP && !this.BC.MT.empty(this.BC.T.extract('keyboard.rows', Parcel))) {
            sending.keyboard = Parcel.keyboard;
        } else {
            // sending.message = sending.message + Parcel.keyboard;
        }
        return ctx.send(sending).then((messageId) => messageId);
    }

    async send (Parcel) {
        let sending = {
            message: Parcel.message,
            peer_id: Parcel.peerId,
            attachment: await this.upload(Parcel.peerId, Parcel.attachments),
        };
        if (this.mode === this.MODES.GROUP && !this.BC.MT.empty(this.BC.T.extract('keyboard.rows', Parcel))) {
            sending.keyboard = Parcel.keyboard;
        } else {
            // sending.message = sending.message + Parcel.keyboard;
        }
        return this.Transport.api.messages.send(sending).then((messageId) => messageId);
    }

    async upload (peerId, attachments) {
        let result = '';
        if (!this.BC.MT.empty(attachments)) {
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

    async fetchUserInfo (userId) {
        let userInfo;
        let result;
        if (userId === this.BC.SELF_SEND || userId === 0 || userId === undefined) {
            userInfo = this.user;
        } else {
            let params = {
                fields: [
                    'screen_name',
                ],
                user_ids: [
                    userId
                ]
            };
            userInfo = await this.Transport.api.users.get(params);
            // if (!this.BC.MT.empty(userInfo) && !this.BC.MT.empty(userInfo[0])) {
            //     userInfo = userInfo[0];
            // }
        }
        result = {
            id: userInfo[0].id,
            username: userInfo[0].screen_name,
            first_name: userInfo[0].first_name,
            last_name: userInfo[0].last_name,
            full_name: userInfo[0].first_name + ' ' + userInfo[0].last_name,
            type: 'user',
        };
        console.log(userInfo);
        return result;
    }

    async launch(middleware, ...middlewares) {

        let result;
        switch (this.mode) {
            case this.MODES.GROUP:
                result = this.Transport.updates.start().catch(console.error);
                break;

            case this.MODES.USER:
                let auth = this.Transport.auth.androidApp();
                result = auth.run()
                    .then((response) => {
                        // console.log('User response:',response);
                        this.Transport.token = response.token;
                        return this.Transport.updates.start().catch(console.error);
                    })
                    .catch((error) => {
                        console.error(error);
                    });
                break;
        }

        result.then(() => {
            if (this._mode === this.MODES.GROUP) {
                if (this.params.pollingGroupId) {
                    this.Transport.api.groups.getById({group_id: this.params.pollingGroupId}).then(user => {
                        this.user = user;
                        console.log(this.user)
                    });
                } else {
                    this.user = {id: 0};
                }
            } else {
                this.Transport.api.users.get({fields: ['screen_name']}).then(user => {
                    this.user = user;
                    console.log(this.user)
                });
            }
            console.log('VK started');
        }).catch(console.error);

        // this.Transport.updates.start().catch(console.error);
        // this.Transport.updates.startPolling();

        return result;
    }
}


//     vk.updates.hear(/hello/i, context => (
//     context.send('World!')
// ));


module.exports = Object.assign(VKontakte, {VK});
module.exports.default = Object.assign(VKontakte, {VK});