const Telegraf = require('telegraf');
const TelegramAPI = require('telegraf/telegram');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const LocalSession = require('telegraf-session-local');
const MySQLSession = require('telegraf-session-mysql');

/** Telegram driver
 * @class
 *
 * @property {Object} defaults
 * @property {string} driverName
 * @property {string} name
 *
 * @property {BotCMS} BC
 * @property {Telegraf} Transport
 * @property {TelegramAPI} Telegram
 */

class Telegram {
    constructor (BC, params = {}) {
        this.BC = BC;

        let sessionDefaultHandler = this.BC.config.db !== 'mysql' ? LocalSession : MySQLSession;
        let sessionDefaultParams = this.BC.config.db !== 'mysql' ? {database: 'telegram_db.json'} : {
            host: this.BC.config.db.host,
            user: this.BC.config.db.username,
            password: this.BC.config.db.password,
            database: this.BC.config.db.database,
        };

        this.defaults = {
            name: 'tg',
            driverName: 'tg',
            humanName: 'Telegram',
            sessionHandler: sessionDefaultHandler,
            sessionParams: sessionDefaultParams,
            extraParams: {
                markup: {
                    key: 'parse_mode',
                    values: {
                        md: 'MarkdownV2',
                        html: 'HTML',
                    }
                },
                silent: 'disable_notification',
                caption: 'caption',
                duration: 'duration',
                title: 'title',
                performer: 'performer',
                width: 'width',
                height: 'height',
                latitude: 'latitude',
                longitude: 'longitude',
            }
        };
        this.tgUser = {};
        this.name = params.name || this.defaults.name;
        this.driverName = params.driverName || this.defaults.driverName;
        this.humanName = params.humanName || this.defaults.humanName;
        let sessionHandler = params.sessionHandler || this.defaults.sessionHandler;
        let sessionParams = params.sessionParams || this.defaults.sessionParams;
        // console.log('TG: ');
        // console.log(params);
        this.transport = new Telegraf(params.token);
        this.transport.use((new sessionHandler(sessionParams)).middleware());
        this.Telegram = new TelegramAPI(params.token);
        if (Array.isArray(params.middlewares)) {
            for (let mw of params.middlewares) {
                // let menu = new TelegrafInlineMenu(ctx => `Hey ${ctx.from.first_name}!`);
                // this.transport.use(menu.init());
                this.transport.use(mw);
            }
        }
    }

    isAvailable () {
        return typeof this.transport === 'object';
    }

    async defaultCallback (t, ctx) {
        // console.log(ctx.update);
        // console.log(ctx.update.message.photo);

        /** @type {Context} **/
        let bcContext = new this.BC.config.classes.Context(this.BC, this, ctx);

        let chatType = '';
        switch (ctx.update.message.chat.type) {
            case 'private':
                chatType = 'user';
                break;
            case 'group':
                chatType = 'chat';
                break;
        }
        bcContext.Message.chat = {
            id: ctx.update.message.chat.id,
            type: chatType,
        };
        if (this.tgUser.id === ctx.update.message.from.id || ctx.update.message.from.id === 919148116) {
            bcContext.Message.sender = {
                id: this.BC.SELF_SEND,
                isBot: true,
                username: this.name,
            };
        } else {
            bcContext.Message.sender = {
                id: ctx.update.message.from.id,
                isBot: ctx.update.message.from.is_bot,
                username: ctx.update.message.from.username,
            }
        }
        bcContext.Message.id = ctx.update.message.message_id;
        bcContext.Message.date = ctx.update.message.date;
        bcContext.Message.text = ctx.update.message.text;

        if (ctx.update.message.hasOwnProperty('reply_to_message')) {
            bcContext.Message.reply = {
                id: ctx.update.message.reply_to_message.message_id,
                text: ctx.update.message.reply_to_message.text,
                chatId: ctx.update.message.reply_to_message.chat.id,
                senderId: ctx.update.message.reply_to_message.from.id,
            }
        }

        if (ctx.update.message.hasOwnProperty('photo')) {
            const photo = this.getMaxPhoto(ctx.update.message['photo']);
            this.Telegram.getFileLink(photo.file_id).then((link) => {
                bcContext.Message.handleAttachment({
                    type: this.BC.ATTACHMENTS.PHOTO,
                    link: link,
                    id: photo.file_id,
                    size: photo.file_size,
                    width: photo.width,
                    height: photo.height,
                });
                return t.BC.handleUpdate(bcContext);
            });
        } else if (ctx.update.message.hasOwnProperty(this.BC.ATTACHMENTS.VIDEO)) {
            return t.BC.handleUpdate(bcContext);
        } else {
            return t.BC.handleUpdate(bcContext);
        }
    }

    listen () {
        this.transport.on('message', (ctx) => {return this.defaultCallback(this, ctx)});
    }

    kbBuild (keyboard) {
        // console.log(keyboard.buttons);
        if (keyboard.options.indexOf('simple') > -1) {
            let kb = Markup.keyboard(keyboard.buttons);

            // console.log(kb.removeKeyboard);
            // kb = kb.removeKeyboard();

            for (let option of keyboard.options) {
                // console.log('[TG] BUILD KB. OPTION: ' + option + ', kb[option]: ', kb[option]);
                if (!this.BC.MT.empty(kb[option])) {
                    console.log('[TG] BUILD KB. OPTION FOUND: ' + option);
                    kb = kb[option]();
                }
            }
            return kb;
        }
        return undefined;

    }

    kbRemove (ctx) {
        console.log('[TG] KB REMOVE');
        return Markup.removeKeyboard().extra();
    }

    getMaxPhoto (photos) {
        let result = {};
        let size = 0;
        for (const photo of photos) {
            if (photo.file_size > size) {
                result = photo;
            }
        }
        return result;
    }

    reply (ctx, Parcel) {
        return this.send(Parcel);
    }

    async send (Parcel) {
        console.log('TG SEND MESSAGE. IN DATA ', Parcel);
        let afterSend = message => {
            this.defaultCallback(this, {update: {message: message}});
            return message.message_id;
        };
        for (let type in Parcel.attachments) {
            if (Parcel.attachments.hasOwnProperty(type)) {
                if (Array.isArray(Parcel.attachments[type]))
                    for (let attachment of Parcel.attachments[type]) {
                        if (typeof attachment === 'string') {
                            attachment = {
                                file: attachment,
                            }
                        }
                        let file = {source: attachment.file};
                        delete attachment.file;
                        let params = [Parcel.peerId];
                        let method = '';
                        if (type === this.BC.ATTACHMENTS.AUDIO) {
                            method = 'sendAudio';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.PHOTO) {
                            method = 'sendPhoto';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.FILE) {
                            method = 'sendDocument';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.POLL) {
                            method = 'sendPoll';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.STICKER) {
                            method = 'sendSticker';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.VIDEO) {
                            method = 'sendVideo';
                            params.push(file);
                        }
                        let extra = this.extraBuild(attachment);
                        if (!this.BC.MT.empty(extra)) {
                            params.push(extra);
                        }
                        //  LINK, POST, FORWARD
                        console.log('ATTACHMENT SEND. METHOD: ', method, ' PARAMS ', params);

                        if (method !== '') {
                            await this.Telegram[method](...params).then(afterSend);
                        }
                }
            }
        }
        if (Parcel.message !== '') {
            let message = Parcel.message;
            let extra = {};
            if (typeof Parcel.message === 'object') {
                message = Parcel.message.text;
                extra = this.extraBuild(Parcel.message);
            }
            extra = this.BC.MT.mergeRecursive(Parcel.keyboard, extra);
            await this.Telegram.sendMessage(Parcel.peerId, message, extra).then(afterSend);
        }
        return true;
    }

    extraBuild (params) {
        let extra = {};
        for (let key in this.defaults.extraParams) {
            if (this.defaults.extraParams.hasOwnProperty(key) && params.hasOwnProperty(key)) {
                let eKey = this.defaults.extraParams[key];
                if (this.BC.MT.isString(eKey)) {
                    extra[eKey] = params[key];
                } else {
                    params[key].key;
                    let value = this.BC.MT.extract(params[key], eKey.values);
                    if (!this.BC.MT.empty(value)) {
                        extra[ eKey.key ] = value;
                    }
                }
            }
        }
        console.log('TG EXTRA BUILD: ', extra);
        return extra;
    }

    async fetchUserInfo (userId, chatId = -339037207) {
        let result = {};
        if (userId === this.BC.SELF_SEND || userId === 0 || userId === undefined) {
            result = {
                id: this.tgUser.id,
                username: this.tgUser.username,
                first_name: this.tgUser.first_name,
                last_name: this.tgUser.last_name,
            }
        } else {
            // console.log(typeof this);
            // console.log(typeof this.Telegram);
            console.log("USER ID: %s, CHAT ID: %s", userId, chatId);
            let userInfo = await this.Telegram.getChatMember(chatId, userId);
            console.log(userInfo);
            if (!this.BC.MT.empty(userInfo)) {
                result = {
                    id: userInfo.user.id,
                    username: userInfo.user.username,
                    first_name: userInfo.user.first_name,
                    last_name: userInfo.user.last_name,
                    full_name: userInfo.user.first_name + ' ' + userInfo.user.last_name,
                    type: userInfo.user.is_bot ? 'bot' : 'user',
                }
            }
        }
        return result;
    }

    async launch (middleware, ...middlewares) {
        let result = this.transport.launch(middleware, ...middlewares).then(() => {
            console.log('TG started');
            this.Telegram.getMe().then(user => {this.tgUser = user; console.log(user)});
        });

        return result;
    }

}

module.exports = Object.assign(Telegram, {Telegraf});
module.exports.default = Object.assign(Telegram, {Telegraf});