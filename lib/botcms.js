const MVTools = require('mvtools');
const CronJob = require('cron').CronJob;
const {MiddlewareManager} = require('js-middleware');

const Answer = require('./answer')
const Attachment = require('./attachment')
const Context = require('./context')
const Keyboard = require('./keyboard')
const Lexicons = require('./lexicons')
const Message = require('./message')
const Parcel = require('./parcel')
const SessionManager = require('./sessionmanager')
const Scripts = require('./scripts')
const Templater = require('mvl-handlebars-handler')
const Tools = require('./tools')

/**
 * @typedef {string|Object} scriptStepTrigger
 * @property {string} [type]
 * @property {string|string[]} value
 */

/**
 * @typedef {string|Object} scriptStepValidator
 * @property {string} validator
 * @property {any} params
 * @property @deprecated {any} validator-params
 * @property {string} failure
 * @property {string} success
 * @property {Object<string, string>} switch
 */

/**
 * @typedef {boolean|Object} scriptStepStore
 * @property {boolean} [clean]
 * @property {string} [thread]
 * @property {string} [key]
 */

/**
 * @typedef {Object} scriptStep
 * @property {scriptStepTrigger|scriptStepTrigger[]} [trigger]
 * @property {boolean} [command]
 * @property {string|{text: string, markup: string}} [message]
 * @property {Object<string, Object[]>} [attachments]
 * @property {import('./keyboard.js').kbObject} [keyboard]
 * @property {string} [keyboard_name] DEPRECATED. Use "keyboard" instead of this
 * @property {string|{type: string, name: string, params: *}} [action]
 * @property {scriptStepValidator} [validate]
 * @property {scriptStepValidator} [goto]
 * @property {scriptStepStore} [store]
 * @property {scriptStepStore} [storePre]
 * @property {scriptStepStore} [store_pre] DEPRECATED: Use "storePre" instead of this
 * @property {boolean} [replace] Indicates if new messages must replace (edit) original
 * @property {Object<string, scriptStep>} [c]
 * @property {string} [path]
 */

/**
 * BotCMS is a simple way to use bots at most popular networks from one point
 * @class
 *
 * @property {Object<string, string>} ATTACHMENTS
 * @property {Object<string, string>} BINDINGS
 * @property {string} SELF_SEND=__self__
 * @property {Object<string, Object>} bridges
 * @property {Array} commands
 * @property {Object} config
 * @property {Object} defaults
 * @property {Object} keyboards
 *
 * @property {MVTools} MT
 * @property {Tools} T
 * @property {Scripts} Scripts
 * @property {MiddlewareManager} MiddlewareManager
 * @property {Lexicons} Lexicons
 * @property {Scripts} Scripts
 * @property {Templater} Templater
 * @property {Object|null} DB
 *
 * @function lexicon
 *
 */

class BotCMS {

    /**
     * @constructor
     * @param {Object} config
     */
    constructor (config = {}) {

        this.ATTACHMENTS = {
            PHOTO: 'photo',
            VIDEO: 'video',
            AUDIO: 'audio',
            FILE: 'file',
            LINK: 'link',
            POST: 'post',
            POLL: 'poll',
            STICKER: 'sticker',
            FORWARD: 'forward',
        };
        this.BINDINGS = {
            FILE: '$FILE ',
            METHOD: '$METHOD ',
        };
        this.SELF_SEND = '__self__';

        this.bridges = {};
        this.commands = [];
        this.config = {};
        this.keyboards = {};

        this.defaults = {
            classes: {
                /** @deprecated */
                Answer,
                Attachment,
                Context,
                /** @deprecated */
                KeyBoard: Keyboard,
                Keyboard,
                Lexicons,
                Message,
                Parcel,
                SessionManager,
                Scripts,
                Templater,
                Tools,
            },
            db: {},
            language: 'en',
            drivers: {
                tg: './drivers/telegram',
                vk: './drivers/vkontakte',
            },
            launchDelay: 500,
            loaders: ['lexicons', 'keyboards', 'scripts', 'config', 'cron', 'middlewares'],
            middlewareMethods: [],
            middlewares: {},
            networks: [],
            requireModule: false,
        };

        this.MT = new MVTools();
        this.loadConfig(config);

        this.T = new this.config.classes.Tools(this);
        this.Lexicons = new this.config.classes.Lexicons(this);
        this.Scripts = new this.config.classes.Scripts(this);
        this.Templater = new this.config.classes.Templater();
        this.MiddlewareManager = new MiddlewareManager(this);
        this.DB = null;

        this.useMultiple(this.config.middlewareMethods);
        this.useMultiple(this.config.middlewares);
    }

    async loadSchema (schema = {}, path = '') {
        schema = this.MT.readConfig(schema, this.BINDINGS.FILE, path, true);
        for (let loader of this.config.loaders) {
            if (schema.hasOwnProperty(loader) && !this.MT.empty(schema[loader])) {
                let method = 'load' + loader[0].toUpperCase() + loader.substring(1);
                try {
                    this[method](schema[loader]);
                } catch (e) {}
            }
        }
    }

    loadConfig (config) {
        this.config = this.MT.mergeRecursive(this.defaults, this.config, config);
    }

    loadLexicons (lexicons) {
        this.Lexicons.load(lexicons);
    }

    loadKeyboards (keyboards) {
        this.keyboards = this.MT.mergeRecursive(this.keyboards, keyboards);
    }

    loadScripts (scripts) {
        this.Scripts.load(scripts);
    }

    /**
     * @param {Object<string, scriptStep>} jobs
     */
    loadCron (jobs) {
        for (let key in jobs) {
            if (Object.prototype.hasOwnProperty.call(jobs, key)) {
                this.addCronJob(jobs[key]);
            }
        }
    }

    /**
     * @param {scriptStep} jobData
     */
    addCronJob (jobData) {
        let schedule = this.MT.isString(jobData.trigger) ? jobData.trigger : jobData.trigger.value;
        let job = new CronJob(schedule, () => this.processCronJob((jobData)), () => {}, false, 'Atlantic/Reykjavik');
        job.start();
    }

    processCronJob (jobData) {
        return this.doAction(jobData);
    }

    /**
     * Load middleware packages from definitions in schema
     * @deprecated
     * @param middlewares
     * @return {Promise<void>}
     */
    async loadMiddlewares (middlewares) {
        for (let name in middlewares) {
            if (Object.prototype.hasOwnProperty.call(middlewares, name)) {
                await new Promise((resolve) => {
                    // this.mwParams[name] = middlewares[name];
                    // console.log(name);
                    // console.log(middlewares[name]);
                    let mw;
                    if (this.config.requireModule) {
                        mw = this.config.requireModule(name);
                    } else {
                        mw = require(name);
                    }
                    resolve(new mw);
                })
                    .then(m => {
                        // console.log(m);
                        this.use(m);
                    })
                    .catch(reason => console.error('MIDDLEWARE ' + name + ' FAILED TO START. SKIPPED. DETAILS', reason));
            }
        }
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
            switch (step) {
                case 'handle':
                    step = 'handleUpdate';
                    break;
                case 'process':
                    step = 'doUpdate';
                    break;
                case 'action':
                    step = 'doAction';
                    break;
                default:
                    step = '';
            }
            if (!this.MT.empty(step)) {
                this.MiddlewareManager.use(step, method);
            }
        } else {
            method = step;
            this.MiddlewareManager.use(method);
        }
    }

    async init () {
        await this.initNetworks(this.config.networks);
        await this.initDB();
    }

    async initNetworks (networks) {
        let promises = [];
        if (!this.MT.empty(networks)) {
            for (let network in networks) {
                if (!networks.hasOwnProperty(network)) {
                    continue;
                }
                promises.push( (async () => {
                    let name = networks[network]['name'] ? networks[network]['name'] : network;
                    let driver;
                    let driverName = this.MT.empty(networks[network]['driver']) ? name : networks[network]['driver'];
                    if (typeof this.config.drivers[driverName] === 'string') {
                        driver = require(this.config.drivers[driverName]);
                    } else {
                        driver = this.config.drivers[driverName];
                    }
                    if (this.MT.empty(driver)) {
                        console.error('ERROR. NO DRIVER FOR NETWORK ', driverName);
                        return;
                    }
                    // console.log('INIT NETWORKS. NAME', name, 'DRIVER NAME', driverName);
                    let tmp = new driver(this, networks[network]);
                    if (tmp.isAvailable() === true) {
                        this.bridges[name] = tmp;
                        this.bridges[name].listen();
                    } else {
                        console.error('ERROR. DRIVER FOR NETWORK ' + driverName + ' FOUND, BUT NETWORK NOT AVAILABLE');
                    }
                    return true;
                })());
            }
        }
        return Promise.all(promises);
    }

    async initDB() {
        return this.DB !== null ? this.successDB() : this.failDB('NO ACTIVE DB')
    }

    successDB () {}

    failDB (error) {}

    async handleUpdate (ctx) {
        // return;
        console.debug('======================');
        console.debug('=== HANDLE UPDATE ====');
        console.debug('======================');

        if (ctx.Message.sender.id === this.SELF_SEND) {
            console.debug(' ');
            console.debug('======================');
            console.debug('=== SELF  MESSAGE ====');
            console.debug('======= RETURN =======');
            console.debug('======================');
            return;
        }

        if (ctx.isProcessed) {
            console.debug(' ');
            console.debug('======================');
            console.debug('== MESSAGE  ALREADY ==');
            console.debug('===== PROCESSED. =====');
            console.debug('======= RETURN =======');
            console.debug('======================');
            return;
        }

        console.log('MESSAGE: ' + ctx.Message.text);
        // console.log('SESSION: ', ctx.session);

        let opts = {};
        let updateSession = true
        let path = this.MT.extract('Message.query.path', ctx)
        if (path) {
            updateSession = false
        }
        if (!path) {
            path = this.MT.extract('session.step.path', ctx)
        }
        if (!path) {
            // scope -- deprecated
            path = this.MT.extract('session.step.scope', ctx)
        }
        if (!path) {
            path = 'c'
        }
        // console.log('PATH', path)

        let keyboardOptions = this.Scripts.extract(path + '.keyboard.options');
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        let nextStep = {};
        let step = await this.getStepByCommand(ctx);
        if (step !== undefined) {
            nextStep = step;
        } else {
            step = this.Scripts.extract(path);
            if (!this.MT.empty(step)) {
                let validate = this.MT.extract('validate', step, {});
                let actions = await this.T.processGotos(ctx, validate);
                await this.doMethods(actions.methods);
                await this.doHelp(ctx, actions.help, opts);
                this.store(step, ctx);
                nextStep = await this.findNextStep(actions, ctx);
            } else {
                console.error('NEXT STEP PATH ' + path + ' SPECIFIED AND NOT FOUND');
            }
        }

        let result
        if (this.MT.empty(nextStep)) {
            if (this.MT.extract('defaults.action', this.config) === 'help') {
                nextStep = this.Scripts.extract('c.help')
                updateSession = false
            }
        }

        result = await this.doUpdate(nextStep, ctx, updateSession, opts);
        return result
    }

    /**
     *
     * @param {scriptStep} current
     * @param {Context} ctx
     * @param {boolean} updateSession
     * @param {Object} opts
     * @return {Promise<null|*>}
     */
    async doUpdate (current, ctx, updateSession = true, opts = {}) {

        // console.log('DO UPDATE. CURRENT: ', current);
        // console.log('DO UPDATE. OPTS', opts);
        if (this.MT.empty(current)) {
            return null;
        }
        ctx[updateSession ? 'session' : 'state'].step = current;
        this.store(current, ctx, true);
        let result = null;
        let keyboard = await (new this.config.classes.Keyboard(ctx, current.keyboard_name || current.keyboard)).build();

        await this.doAction(current, ctx);

        if (!this.MT.empty(current.message)) {
            let parcel = new this.config.classes.Parcel();
            parcel.message = await ctx.lexicon(current.message);
            parcel.peerId = ctx.Message.chat.id;
            parcel.keyboard = keyboard;
            parcel.attachments = current.attachments || {};
            parcel.editMsgId = (ctx.Message.author.id === this.SELF_SEND && !!current.replace) ? ctx.Message.id : 0
            result = await ctx.reply(parcel);
        }
        let goto = this.MT.extract('goto', current);
        if (!this.MT.empty(goto)) {
            let actions = await this.T.processGotos(ctx, goto);
            await this.doMethods(actions.methods);
            await this.doHelp(ctx, actions.help, opts);
            let nextStep = await this.findNextStep(actions, ctx, [current.path]);
            if (!this.MT.empty(nextStep)) {
                return this.doUpdate(nextStep, ctx, true, opts);
            }
        }
        return result;
    }

    async doAction(step, ctx = undefined) {
        let promises = [];
        if (!this.MT.empty(step.action)) {
            // console.log('BOTCMS DO ACTION. ACTION: ', step.action);
            if (this.MT.isString(step.action)) {
                step.action = {type: 'method', name: step.action};
            }
            let type = this.MT.extract('type', step.action, 'method');
            let parameters = this.MT.extract('params', step.action, this.MT.extract('options', step.action, {}));
            let params = this.MT.copyObject(parameters);
            switch (type) {
                case 'send':
                    let fromScope = this.MT.extract('from_scope', params);
                    let targets = this.MT.extract('target', params);
                    let message = ctx ? await ctx.lexicon(step.message) : await this.Lexicons.process(step.message);

                    if (!this.MT.empty(fromScope) && !this.MT.empty(ctx)) {
                        let answers = ctx.session.answers;
                        if (!this.MT.empty(answers[fromScope])) {
                            message = await ctx.lexicon(this.MT.extract('message', params, step.message)) + "\n\n";
                            for (let key in answers[fromScope]) {
                                if (answers[fromScope].hasOwnProperty(key)) {
                                    message = message + await ctx.lexicon(answers[fromScope][key].message) + '>> ' + answers[fromScope][key].answer + "\n\n";
                                }
                            }
                        }
                    }

                    if (!this.MT.empty(targets)) {
                        for (let name in targets) {
                            if (targets.hasOwnProperty(name) && !this.MT.empty(this.bridges[name])) {
                                let peers = this.MT.makeArray(targets[name]);
                                let kb = new this.config.classes.Keyboard(this, params.keyboard || step.keyboard);
                                kb.bridge = name;
                                let keyboard = await kb.build()
                                for (let peer of peers) {
                                    if (this.MT.empty(this.bridges[name])) {
                                        console.error('WRONG TRANSPORT NAME ' + name + ' IN ACTION BLOCK');
                                        continue;
                                    }
                                    let parcel = new this.config.classes.Parcel();
                                    peer = (peer === this.SELF_SEND) ? ctx.Message.sender.id : peer;
                                    parcel.peerId = peer;
                                    parcel.message = message || '';
                                    parcel.keyboard = keyboard
                                    promises.push(this.bridges[name].send(parcel));
                                }
                            }
                        }
                    }
                    break;

                case 'method':
                    let path = step.action.name || step.action.value;
                    let method = this.MT.extract(path);
                    if (method) {
                        promises.push(method(ctx, params));
                    } else {
                        console.error('BOTCMS DO ACTION. METHOD ' + step.action.name + ' NOT FOUND');
                    }
                    break;
            }
        }
        return Promise.all(promises).catch(reason => console.error('ERROR WHILE EXEC ACTION: ', reason));
    }

    async doMethods (ctx, methods) {
        methods = this.MT.makeArray(methods);
        for (let method of methods) {
            method = this.MT.extract(method);
            if (!this.MT.empty(method)) {
                await method(ctx);
            }
        }
    }

    async doHelp (ctx, helpPath, opts = {}) {
        if (this.MT.empty(helpPath)) {
            return;
        }
        const helpStep = this.Scripts.extract(helpPath);
        if (!this.MT.empty(helpStep)) {
            await this.doUpdate(helpStep, ctx, false, opts);
        } else {
            console.error('PATH ' + helpPath + ' NOT FOUND');
        }
    }

    async getStepByCommand (ctx) {
        // console.log('GET STEP BY COMMAND. TYPE OF COMMAND: ', typeof ctx);
        // if (typeof ctx.Message.text !== 'string') {
        //     return undefined;
        // }
        for (let i in this.commands) {
            if (!this.commands.hasOwnProperty(i)) {
                continue;
            }
            const path = this.commands[i];
            // console.log('GET STEP BY COMMAND. PATH: ' + path);
            let step = this.Scripts.extract(path);
            if (step !== undefined && !this.MT.empty(step.trigger) && await this.T.checkTrigger(ctx, step.trigger)) {
                // console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    async findNextStep (actions, ctx, exclude = []) {
        let nextStep = {};
        if (!this.MT.empty(actions)) {
            if (!this.MT.empty(actions.goto)) {
                const next = this.Scripts.extract(actions.goto);
                // console.info('BOTCMS HANDLE UPDATE. NEXT STEP: ', next);
                if (!this.MT.empty(next)) {
                    if (this.T.isChildrenPath(actions.goto)) {
                        // console.error('FIND NEXT STEP. NEXT PATH IS CHILDREN');
                        for (let key in next) {
                            if (next.hasOwnProperty(key)) {
                                // console.error('FIND NEXT STEP. CHECK KEY: ', key, ' TRIGGER: ', next[key].trigger);
                                if (await this.T.checkTrigger(ctx, next[key].trigger)) {
                                    if (exclude.indexOf(next[key].path) === -1) {
                                        nextStep = next[key];
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        if (exclude.indexOf(next.path) === -1) {
                            nextStep = next;
                        }
                    }
                } else {
                    console.error('NEXT STEP PATH ' + actions.goto + ' SPECIFIED AND NOT FOUND');
                }
            } else {
                console.error('FIND NEXT STEP. ACTIONS IS NOT undefined BUT GOTO NOT FOUND');
            }
        }
        // console.log('FOUND NEXT STEP: ', nextStep);
        return nextStep;
    }

    /** @deprecated */
    async buildAnswer (ctx, step) {
        // console.log('BUILD ANSWER. STEP ', step);
        const Answer = new this.config.classes.Answer(this, ctx, step);
        return Answer.build();
    }

    /**
     *
     * @param {scriptStep} step
     * @param {Context} ctx
     * @param {boolean} pre
     */
    store (step, ctx, pre = false) {
        let store = (pre ? (step.storePre || step.store_pre) : step.store) || {};
        if (this.MT.empty(store)) {
            return;
        }
        if (store === true) {
            store = {};
        }
        store.thread = store.thread || this.T.extractAnswerThread(step);
        ctx.session.answers = ctx.session.answers || {};
        let cleanOld = store.clear || store.clean || !this.MT.empty(step['store-clean']) || !this.MT.empty(step['store_clean']);
        if (cleanOld || !(ctx.session.answers[store.thread] instanceof Object)) {
            ctx.session.answers[store.thread] = {};
        }
        let key = store.key || Object.keys(ctx.session.answers[store.thread]).length + 1;
        let answerData = {
            message: step.message,
            answer: ('value' in store) ? store.value : ctx.msg,
        };
        ctx.session.answers[store.thread] = this.MT.setByPath(key, ctx.session.answers[store.thread], answerData);
        // console.log('STORE ANSWER. ANSWERS THREAD ' + store.thread + ' UPDATED: ', ctx.session.answers[store.thread]);
    }

    /**
     *
     * @param {string} key Key of lexicon entry
     * @param {Object} [params] Additional params
     * @param {string} [language] Language
     * @param {Context} [ctx] Context of user message
     * @return {*|Promise<*>|string}
     */
    lexicon (key, params = {}, language = undefined, ctx = undefined) {
        return this.Lexicons.process(key, params, (language ? language : this.config.language), (ctx ? ctx : this));
    }

    launch (middleware, ...middlewares) {
        let i = 0;
        let bridges = this.bridges;
        for (let network in this.bridges) {
            if (this.bridges.hasOwnProperty(network)) {
                setTimeout((bridge, method, middleware, ...middlewares) => {
                    this.launchNetwork(bridge, middleware, ...middlewares)
                }, this.config.launchDelay * i, bridges[network], middleware, ...middlewares);
            }
            i = i + 1;
        }
    }

    launchNetwork(bridge, middleware, ...middlewares) {
        bridge.launch(middleware, ...middlewares).then(() => {
            if (this.MT.extract('notifyLaunch.bridge', this.config) === bridge.name) {
                let parcel = new this.config.classes.Parcel();
                parcel.peerId = this.MT.extract('notifyLaunch.peerId', this.config);
                parcel.message = this.MT.extract('notifyLaunch.message', this.config);
                bridge.send(parcel);
            }
        });
        // console.log('TIMED OUT. NETWORK %s, METHOD %s', network, method);
    }
}

BotCMS.Attachment = Attachment
BotCMS.Context = Context
BotCMS.Keyboard = Keyboard
BotCMS.Message = Message
BotCMS.Parcel = Parcel
BotCMS.Tools = Tools
BotCMS.MVTools = MVTools

module.exports = BotCMS;
module.exports.default = BotCMS;