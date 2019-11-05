const Telegraf = require('telegraf');
const TelegramAPI = require('telegraf/telegram');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const LocalSession = require('telegraf-session-local');

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
        this.defaults = {
            name: 'tg',
            driverName: 'tg',
            humanName: 'Telegram',
            sessionHandler: LocalSession,
            sessionStorage: 'telegram_db.json',
        };
        this.tgUser = {};
        this.name = params.name || this.defaults.name;
        this.driverName = params.driverName || this.defaults.driverName;
        this.humanName = params.humanName || this.defaults.humanName;
        let sessionHandler = params.sessionHandler || this.defaults.sessionHandler;
        let sessionStorage = params.sessionStorage || this.defaults.sessionStorage;
        let sessionParams = params.sessionParams || {
            database: sessionStorage,
        };
        // console.log('TG: ');
        // console.log(params);
        this.transport = new Telegraf(params.token);
        this.transport.use((new sessionHandler(sessionParams)).middleware());
        this.Telegram = new TelegramAPI(params.token);
    }

    isAvailable () {
        return typeof this.transport === 'object';
    }

    async defaultCallback (t, ctx) {
        console.log(ctx.update);
        // console.log(ctx.update.message.photo);

        /** @type {Context} **/
        let bcContext = new this.BC.classes.Context(this.BC, this, ctx);

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
                if (!this.BC.T.empty(kb[option])) {
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
        return Markup.removeKeyboard(true);
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
        console.log(Parcel);
        if (ctx.reply) {
            return ctx.reply(Parcel.message, Parcel.keyboard).then(message => {
                this.defaultCallback(this, {update: {message: message}});
                return message.message_id;
            });
        }
    }

    async send (Parcel) {
        console.log('TG SEND MESSAGE. IN DATA ', Parcel);
        return await this.Telegram.sendMessage(Parcel.peerId, Parcel.message).then(message => {
            this.defaultCallback(this, {update: {message: message}});
            return message.message_id;
        });
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
            if (!this.BC.T.empty(userInfo)) {
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