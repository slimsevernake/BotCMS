const {MiddlewareManager} = require('js-middleware');

/**
 * @typedef {Object} callbackData
 * @property {string} data Data to replace empty Message text after button pressed
 * @property {string} [handler] Method name to handle pressed button
 * @property {any} [params] Additional params (to lexicon or handler)
 * @property {string} [hash] Hash as key to store data
 */

/**
 * If string with query id will only stop processing pressed button
 *
 * @typedef {string|Object} answerCallbackData
 * @property {string} id Unique identifier for the query to be answered
 * @property {string} [answer] Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters
 * @property {boolean} [alert] If true, an alert will be shown by the client instead of a notification at the top of the chat screen
 * @property {int} [cacheTime] The maximum amount of time in seconds that the result of the callback query may be cached client-side. Telegram apps will support caching starting in version 3.14. Defaults to 0.
 */

/**
 * @class Class for Inbound message context
 *
 * @property {Object<string, *>} context
 * @property {import('./message.js')} Message
 * @property {Object<string, *>} session
 * @property {Object<string, *>} state
 * @property {boolean} isProcessed
 * @property {string} msg Text of inbound message
 * @property {string} language User selected language
 *
 * @property {Object} Bridge
 * @property {import('./botcms.js')} BC
 */

class Context {
    /**
     *
     * @param {import('./botcms.js')} BC
     * @param Bridge
     * @param {Object} [context]
     * @param {Object} [config]
     */
    constructor (BC, Bridge, context, config = {}) {
        this.defaults = {
            useSession: true,
            session: {
                getStorageKey: context => this.Message.selfSend() ? '' : (String(context.Bridge.name) + ':' + String(context.Message.chat.id) + ':' + String(context.Message.sender.id)),
                targetKey: 'session'
            },
            callbackDataKeys: ['data', 'handler', 'params', 'answer'],
            callbackDataSessionKey: 'callbackData'
        }
        this.BC = BC;
        this.Bridge = Bridge;
        this.context = context;
        this.config = this.BC.MT.merge(this.defaults, this.BC.config.Context || {}, config)

        this.Message = new this.BC.config.classes.Message(BC);
        this.session = {};
        this.state = {}
        this._processed = false;

        this.MiddlewareManager = new MiddlewareManager(this);
        if (this.config.useSession) {
            this.SessionManager = new this.BC.config.classes.SessionManager(this.config.session || {})
            this.use('process', this.SessionManager.middleware)
        }

        this.useMultiple(this.config.middlewareMethods);
        this.useMultiple(this.config.middlewares);
    }

    async process () {
        // console.log(this.Message.query)
        if (this.Message.query.id !== '') {

            // console.log(this.Message.query.data)
            // console.log(this.config.callbackDataSessionKey, this.session)
            let stored = this.getCBData(this.Message.query.data)
            // console.log('STORED', stored)
            if (this.BC.MT.empty(stored.data)) {
                stored.data = stored.text
            }
            this.Message.query = this.BC.MT.merge(this.Message.query, stored)
            this.Message.text = this.Message.query.data
            // console.log('CTX MSG QUERY', this.Message.query)
            if (!!this.Message.query.answer) {
                await this.answerCB(this.Message.query)
            }
        }
        return await this.BC.handleUpdate(this)
    }

    /**
     * Send parcel from user to bot.л
     * @param Parcel
     * @return {*}
     */
    async reply (Parcel) {
        await this.answerCB(true)
        if (this.BC.MT.isString(Parcel)) {
            Parcel = new this.BC.config.classes.Parcel(Parcel);
        }
        Parcel.peerId = this.Message.chat.id;
        return this.Bridge.reply(this.context, Parcel)
    }

    remove (msgIds, peerId = undefined) {
        if (!peerId) {
            peerId = this.Message.chat.id
        }
        return this.Bridge.remove(peerId, msgIds)
    }

    /**
     * @param {answerCallbackData} data
     */
    async answerCB (data= true) {
        if (typeof data === 'boolean' || typeof data === 'string') {
            data = this.BC.MT.merge(this.Message.query, { answer: data })
        }
        if (this.BC.MT.empty(data.id)) {
            data.id = this.Message.query.id
        }
        if (data.id !== '') {
            if (data.answer === undefined) {
                data.answer = true
            }
            if (typeof data.answer === 'string') {
                data.answer = await this.lexicon(data.answer, data.params)
            }
            // console.log('ANSWER CB. DATA FINAL', data)
            await this.Bridge.answerCB(data).catch((e) => console.error('ERROR IN ANSWER CALLBACK:', e))
        }
    }

    get isProcessed () {
        return this._processed;
    }

    /**
     * @deprecated
     * @returns {Object<string, *>}
     */
    get singleSession () {
        return this.state
    }

    /**
     * @deprecated
     * @param {Object<string, *>}values
     */
    set singleSession (values) {
        this.state = values
    }

    get msg () {
        return this.Message.text || '';
    }

    /**
     * Set flag processed for context
     * @function
     * @param {boolean} val
     */
    setProcessed (val) {
        this._processed = val;
    }

    get language () {
        return this.session.language || this.BC.config.language;
    }

    /**
     * @function
     * @param {string} value
     */
    set language (value) {
        this.session.language = value;
    }

    /**
     * Parse key with params by Lexicon
     * @function
     * @param {string} key
     * @param {Object<string, string>}params
     * @returns {string}
     */
    lexicon (key, params = {}) {
        return this.BC.lexicon(key, params, this.language, this);
    }

    /**
     * Extract lexicon entry by key and current language
     * @function
     * @param {string} key
     * @returns {string|Object<string, string>}
     */
    lexiconExtract (key) {
        return this.BC.Lexicons.extract(this.language + '.' + key);
    }

    useMultiple (middlewares) {
        if (Array.isArray(middlewares)) {
            for (let middleware of middlewares) {
                this.use(new middleware(this));
            }
        }
    }

    use (step, method) {
        if (typeof step === 'string') {
            if (step in this) {
                // console.log(step, method)
                this.MiddlewareManager.use(step, method);
            }
        } else {
            method = step;
            this.MiddlewareManager.use(method);
        }
    }

    /**
     * @param {string|callbackData} values
     * @return {*}
     */
    storeCBData (values) {
        let data = {}
        if (typeof values === 'string') {
            values = { data: values }
        }
        // console.log('STORE CALLBACK DATA. VALUES 1', values)
        for (let key of this.config.callbackDataKeys) {
            if (key in values) {
                data[key] = values[key]
            }
        }
        if (this.BC.MT.empty(data.path)) {
            let path = this.BC.MT.extract('step.path', this.state, '')
            if (path === '') {
                path = this.BC.MT.extract('step.path', this.session, 'c')
            }
            data.path = path
        }
        // console.log('STORE CALLBACK DATA. DATA 1', data)
        if (this.BC.MT.empty(data.data)) {
            data.data = values.text
        }
        let hash = this.BC.MT.md5(JSON.stringify(data))
        // console.log('STORE CALLBACK DATA. DATA 2', data)
        this.BC.MT.setByPath(this.config.callbackDataSessionKey + '.' + hash, this.session, data)
        return hash
    }

    /**
     * @param {string} hash
     * @return {callbackData|{}}
     */
    getCBData (hash) {
        return this.BC.MT.extract(this.config.callbackDataSessionKey + '.' + hash, this.session, {})
    }

    getAnswer (thread, key, defaults = undefined, includeQuestion = false) {
        return this.BC.MT.extract('answers.' + thread + '.' + key + (includeQuestion ? '' : '.answer'), this.session, defaults)
    }

    /**
     * @param {string} thread
     * @param {boolean} includeQuestions
     * @return {Object<string, string|Object<string, string>>}
     */
    getAnswers (thread, includeQuestions = false) {
        let rawAnswers = this.BC.MT.extract('answers.' + thread, this.session, {})
        let answers = {}
        for (let key in rawAnswers) {
            if (Object.prototype.hasOwnProperty.call(rawAnswers, key)) {
                answers[key] = includeQuestions ? rawAnswers[key] : rawAnswers[key].answer
            }
        }
        return answers
    }

}

module.exports = Context;
module.exports.default = Context;