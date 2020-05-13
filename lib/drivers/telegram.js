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
                noPreview: 'disable_web_page_preview',
                silent: 'disable_notification',
                caption: 'caption',
                duration: 'duration',
                title: 'title',
                performer: 'performer',
                width: 'width',
                height: 'height',
                latitude: 'latitude',
                longitude: 'longitude',
            },
            escapeSymbols: ['-', '+', '\\.', '\\(', '\\)', '\\[', '\\]', '\\{', '\\}'],
            escapeSymbolsReplace: {
                '-': '\\-',
                '+': '\\+',
                '.': '\\.',
                '(': '\\(',
                ')': '\\)',
                '[': '\\[',
                ']': '\\]',
                '{': '\\{',
                '}': '\\}',
            },
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

    async messageCallback (t, ctx) {
        // console.dir(ctx.update, {depth: 5});
        // console.log(ctx.update.message.photo);

        /** @type {Context} **/
        let bcContext = new this.BC.config.classes.Context(this.BC, this, ctx);
        let message = {};
        let edited = false;

        if ('message' in ctx.update) {
            message = ctx.update.message;
        } else if ('edited_message' in ctx.update) {
            message = ctx.update.edited_message;
            edited = true;
        } else if ('channel_post' in ctx.update) {
            message = ctx.update.channel_post;
        } else if ('edited_channel_post' in ctx.update) {
            message = ctx.update.edited_channel_post;
            edited = true;
        }

        if (message === {}) {
            return false;
        }

        let chatType = t.getChatType(message.chat.type);

        bcContext.Message.chat = {
            id: message.chat.id,
            type: chatType,
        };
        if (this.tgUser.id === message.from.id || message.from.id === 919148116) {
            bcContext.Message.sender = {
                id: this.BC.SELF_SEND,
                isBot: true,
                username: this.name,
            };
        } else {
            bcContext.Message.sender = {
                id: message.from.id,
                isBot: message.from.is_bot,
                username: message.from.username,
                fullname: [message.from.first_name, message.from.last_name].join(' ').trim(),
            }
        }
        bcContext.Message.id = message.message_id;
        bcContext.Message.date = message.date;
        bcContext.Message.text = message.text;
        bcContext.Message.edited = edited;

        if (message.hasOwnProperty('forward_date')) {
            let forwarded = {sender: {}, chat: {}};
            forwarded.date = message.forward_date;
            if ('forward_from_message_id' in message) {
                forwarded.id = message.forward_from_message_id;
            }
            if ('forward_signature' in message) {
                forwarded.sender.fullname = message.forward_signature;
            }
            if ('forward_sender_name' in message) {
                forwarded.sender.fullname = message.forward_sender_name;
            }
            if ('forward_from' in message) {
                forwarded.sender = {
                    id: message.forward_from.id,
                    isBot: message.forward_from.is_bot,
                    username: message.forward_from.username,
                    fullname: [message.forward_from.first_name, message.forward_from.last_name].join(' ').trim(),
                };
            }
            if ('forward_from_chat' in message) {
                forwarded.chat = {
                    id: message.forward_from_chat.id,
                    type: t.getChatType(message.forward_from_chat.type),
                };
            }
            bcContext.Message.handleForwarded(forwarded);
        }

        if (message.hasOwnProperty('reply_to_message')) {
            bcContext.Message.reply = {
                id: message.reply_to_message.message_id,
                text: message.reply_to_message.text,
                chatId: message.reply_to_message.chat.id,
                senderId: message.reply_to_message.from.id,
            }
        }

        if (message.hasOwnProperty('photo')) {
            const photo = this.getMaxPhoto(message['photo']);
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
        } else if (message.hasOwnProperty(this.BC.ATTACHMENTS.VIDEO)) {
            return t.BC.handleUpdate(bcContext);
        } else {
            return t.BC.handleUpdate(bcContext);
        }
    }

    listen () {
        this.transport.on('message', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('edited_message', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('channel_post', (ctx) => {return this.messageCallback(this, ctx)});
        this.transport.on('edited_channel_post', (ctx) => {return this.messageCallback(this, ctx)});
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

    getChatType (tgType) {
        let chatType = '';
        switch (tgType) {
            case 'private':
                chatType = 'user';
                break;
            case 'supergroup':
            case 'group':
                chatType = 'chat';
                break;
            case 'channel':
                chatType = 'channel';
                break;
        }
        return chatType;
    }

    reply (ctx, Parcel) {
        return this.send(Parcel);
    }

    async send (Parcel) {
        console.log('TG SEND MESSAGE. IN DATA ', Parcel);
        let messageIds = [];
        let afterSend = message => {
            this.messageCallback(this, {update: {message: message}});
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
                        let action = '';
                        if (type === this.BC.ATTACHMENTS.AUDIO) {
                            method = 'sendAudio';
                            action = 'upload_audio';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.PHOTO) {
                            method = 'sendPhoto';
                            action = 'upload_photo';
                            params.push(file);
                        }
                        if (type === this.BC.ATTACHMENTS.FILE) {
                            method = 'sendDocument';
                            action = 'upload_document';
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
                            action = 'upload_video';
                            params.push(file);
                        }
                        let extra = this.BC.MT.merge(Parcel.keyboard, this.extraBuild(attachment));
                        if (!this.BC.MT.empty(extra)) {
                            params.push(extra);
                        }
                        //  LINK, POST, FORWARD
                        // console.log('ATTACHMENT SEND. METHOD: ', method, ' PARAMS ', params);

                        if (method !== '') {
                            if (action !== '') {
                                this.Telegram.sendChatAction(Parcel.peerId, action).catch(() => {});
                            }
                            messageIds.push(await this.Telegram[method](...params).then(afterSend));
                        }
                }
            }
        }
        if (Parcel.message !== '') {
            let message = Parcel.message;
            let extra = {};
            if (typeof Parcel.message === 'object') {
                message = this.escapeText(Parcel.message.text);
                extra = this.extraBuild(Parcel.message);
            }
            extra = this.BC.MT.mergeRecursive(Parcel.keyboard, extra);
            messageIds.push(await this.Telegram.sendMessage(Parcel.peerId, message, extra).then(afterSend));
        }
        return messageIds;
    }

    extraBuild (params) {
        let extra = {};
        for (let key in this.defaults.extraParams) {
            if (this.defaults.extraParams.hasOwnProperty(key) && params.hasOwnProperty(key)) {
                let eKey = this.defaults.extraParams[key];
                if (this.BC.MT.isString(eKey)) {
                    extra[eKey] = this.escapeText(params[key]);
                } else {
                    params[key].key;
                    let value = this.BC.MT.extract(params[key], eKey.values);
                    if (!this.BC.MT.empty(value)) {
                        extra[ eKey.key ] = this.escapeText(value);
                    }
                }
            }
        }
        // console.log('TG EXTRA BUILD: ', extra);
        return extra;
    }

    escapeText (text) {
        let re = new RegExp('[' + this.defaults.escapeSymbols.join('') + ']', 'g');
        console.log('RE ', re, ' TEXT: ', text);
        return String(text).replace(re, (s) => {
            console.log('ESCAPE TEXT. S: ', s, ' REPLACE: ', this.defaults.escapeSymbolsReplace[s]);
            return this.defaults.escapeSymbolsReplace[s];
        });
    }

    async fetchUserInfo (userId, chatId) {
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
            if (this.BC.MT.empty(chatId)) {
                chatId = userId;
            }
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

    async fetchChatInfo (chatId) {
        let result = {};
        // console.log(typeof this);
        // console.log(typeof this.Telegram);
        console.log("CHAT ID: %s", chatId);
        let chatInfo = await this.Telegram.getChat(chatId);
        console.log(chatInfo);
        if (!this.BC.MT.empty(chatInfo)) {
            result = {
                id: this.BC.MT.extract('id', chatInfo, null),
                username: this.BC.MT.extract('username', chatInfo, null),
                title: this.BC.MT.extract('title', chatInfo, null),
                first_name: this.BC.MT.extract('first_name', chatInfo, null),
                last_name: this.BC.MT.extract('last_name', chatInfo, null),
                full_name: this.BC.MT.extract('first_name', chatInfo, null) + ' ' + this.BC.MT.extract('first_name', chatInfo, null),
                description: this.BC.MT.extract('description', chatInfo, null),
                type: this.getChatType(this.BC.MT.extract('type', chatInfo, null)),
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