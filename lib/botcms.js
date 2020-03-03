const MVTools = require('mvtools');
const CronJob = require('cron').CronJob;
const {MiddlewareManager} = require('js-middleware');
const {createConnection, BaseEntity} = require("typeorm");

/**
 * BotCMS is a simple way to use bots at most popular networks from one point
 * @class
 *
 * @property {Object} bridges
 * @property {Array} commands
 * @property {Object} config
 * @property {Object} defaults
 * @property {Object} keyboards
 *
 * @property {MVTools} MT
 * @property {Tools} T
 * @property {Scripts} Scripts
 * @property {MiddlewareManager} MiddlewareManager
 */

class BotCMS {

    ATTACHMENTS = {
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
    BINDINGS = {
        FILE: '$FILE ',
        METHOD: '$METHOD ',
    };

    SELF_SEND = '__self__';

    bridges = {};
    commands = [];
    config = {};
    keyboards = {};

    defaults = {
        classes: {
            Answer: require('./answer'),
            Attachment: require('./attachment'),
            Context: require('./context'),
            KeyBoard: require('./keyboard'),
            Lexicons: require('./lexicons'),
            Message: require('./message'),
            Parcel: require('./parcel'),
            Scripts: require('./scripts'),
            Templater: require('mvl-handlebars-handler'),
            Tools: require('./tools'),
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

    /**
     * @param {Object} config
     */
    constructor (config = {}) {

        this.MT = new MVTools();
        this.loadConfig(config);

        this.T = new this.config.classes.Tools(this);
        this.Lexicons = new this.config.classes.Lexicons(this);
        this.Scripts = new this.config.classes.Scripts(this);
        this.Templater = new this.config.classes.Templater();
        this.MiddlewareManager = new MiddlewareManager(this);
        this.DB = null;

        this.useMultiple(this.config.middlewareMethods);
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

    loadCron (jobs) {
        for (let key in jobs) {
            if (jobs.hasOwnProperty(key)) {
                this.addCronJob(jobs[key]);
            }
        }
    }

    addCronJob (jobData) {
        let schedule = this.MT.isString(jobData.trigger) ? jobData.trigger : jobData.trigger.value;
        let job = new CronJob(schedule, () => this.processCronJob((jobData)), () => {}, false, 'Atlantic/Reykjavik');
        job.start();
    }

    processCronJob (jobData) {
        this.doAction(jobData);
    }

    async loadMiddlewares (middlewares) {
        for (let name in middlewares) {
            if (middlewares.hasOwnProperty(name)) {
                await new Promise((resolve, reject) => {
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
                    .catch(reason => console.error('MIDDLEWARE ' + name + ' FAILED TO START. SKIPPED.'));
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
                    let driver = '';
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
        if (this.DB !== null) {
            return this.successDB();
        } else if (!this.MT.empty(this.config.db.type)) {
            for (let i in this.config.db.entities) {
                if (this.config.db.entities.hasOwnProperty(i) && typeof this.config.db.entities[i] === "string") {
                    this.config.db.entities[i] = this.config.db.entities[i].replace(process.cwd() + '/', '');
                }
            }
            await createConnection(this.config.db).then(connection => {
                this.DB = connection;
                this.successDB();
            }).catch(error => {
                this.failDB(error)
            });
        }
    }

    successDB () {}

    failDB (error) {}

    async handleUpdate (ctx) {
        // return;
        console.debug('======================');
        console.debug('=== HANDLE UPDATE ====');
        console.debug('======================');

        if (ctx.Message.sender.id === this.SELF_SEND) {
            console.debug('======================');
            console.debug('=== SELF  MESSAGE ====');
            console.debug('======= RETURN =======');
            console.debug('======================');
            return;
        }

        console.log('MESSAGE: ' + ctx.Message.text);
        // console.log('SESSION: ', ctx.session);

        let path = ctx.session.step && ctx.session.step.hasOwnProperty('scope') ? ctx.session.step.scope :
            (ctx.session.step && ctx.session.step.hasOwnProperty('path') ? ctx.session.step.path : 'c');
        let opts = {};

        let keyboardOptions = this.Scripts.extract(path + '.keyboard.options');
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        let step = await this.getStepByCommand(ctx);
        if (step !== undefined) {
            return this.doUpdate(step, ctx, true, opts);
        }

        step = this.Scripts.extract(path);

        // console.log(path);
        // console.log(step);
        if (step !== undefined) {
            let answer = await this.buildAnswer(ctx, step);

            if (!this.MT.empty(step.store)) {
                this.storeAnswer(step, ctx, answer);
            }

            for (let method of answer.methods) {
                method = this.MT.extract(method);
                if (!this.MT.empty(method)) {
                    await method(answer, ctx);
                }
            }

            const helpStep = this.Scripts.extract(answer.help);
            if (!this.MT.empty(helpStep)) {
                await this.doUpdate(helpStep, ctx, false, opts);
            }

            if (!this.MT.empty(answer.goto)) {
                const next = this.Scripts.extract(answer.goto);
                console.info('BOTCMS HANDLE UPDATE. NEXT STEP: ', next);
                if (!this.MT.empty(next)) {
                    if (this.T.isChildrenPath(answer.goto)) {
                        for (let key in next) {
                            if (next.hasOwnProperty(key) && await this.T.checkTrigger(ctx, next[key].trigger)) {
                                return this.doUpdate(next[key], ctx, true, opts);
                            }
                        }
                    } else {
                        return this.doUpdate(next, ctx, true, opts);
                    }
                } else {
                    console.error('NEXT STEP PATH ' + answer.goto + ' SPECIFIED AND NOT FOUND');
                }
            }
        }
        // console.log('BOTCMS HANDLE UPDATE. CONTEXT IS PROCESSED? ', ctx.isProcessed);
        if (!ctx.isProcessed && this.MT.extract('defaults.action', this.config) === 'help') {
            return this.doUpdate(this.Scripts.extract('c.help'), ctx, false, opts);
        }
    }

    async doUpdate (current, ctx, updateSession = true, opts = {}) {

        // console.log('DO UPDATE. CURRENT: ', current);
        // console.log('DO UPDATE. OPTS', opts);
        if (this.MT.empty(current)) {
            return null;
        }
        if (updateSession) {
            ctx.session.step = current;
        }
        if (!this.MT.empty(current.store_pre)) {
            this.storeAnswer(current, ctx, {}, true);
        }
        let result = null;
        let keyboardObj = this.MT.extract(current.keyboard_name, this.keyboards, current.keyboard);
        let keyboard = new this.config.classes.KeyBoard(ctx, keyboardObj).build();
        // if (this.MT.empty(keyboard)) {
        //     keyboard = ctx.Bridge.kbRemove();
        //     // console.log('DO UPDATE. REMOVE KB');
        // }

        this.doAction(current, ctx);

        if (!this.MT.empty(current.message)) {
            let parcel = new this.config.classes.Parcel();
            parcel.message = ctx.lexicon(current.message);
            parcel.peerId = ctx.Message.chat.id;
            parcel.keyboard = keyboard;
            parcel.attachments = current.attachments || {};
            result = ctx.reply(parcel);
        }
        let goto = this.MT.extract('goto', current);
        if (!this.MT.empty(goto)) {
            // console.log(JSON.stringify(this.schema.scripts));
            let newCurrent = this.Scripts.extract(goto);
            // console.log(JSON.stringify(this.schema.scripts));
            if (!this.MT.empty(newCurrent)) {
                if (result) {
                    return result.then(() => {this.doUpdate(newCurrent, ctx, updateSession)});
                }
                return this.doUpdate(newCurrent, ctx, updateSession);
            } else {
                console.error('PATH ' + goto + ' NOT FOUND');
            }
        }
        return result;
    }

    doAction(step, ctx = undefined) {
        if (!this.MT.empty(step.action)) {
            // console.log('BOTCMS DO ACTION. ACTION: ', step.action);
            if (this.MT.isString(step.action)) {
                step.action = {type: 'method', name: step.action};
            }
            let type = this.MT.extract('type', this.action, 'method');
            let params = this.MT.extract('params', step.action, this.MT.extract('options', step.action, {}));
            switch (type) {
                case 'send':
                    let fromScope = this.MT.extract('from_scope', params);
                    let targets = this.MT.extract('target', params);
                    let message = ctx.lexicon(step.message);

                    if (!this.MT.empty(fromScope) && !this.MT.empty(ctx)) {
                        let answers = ctx.session.answers;
                        if (!this.MT.empty(answers[fromScope])) {
                            message = this.MT.extract('message', params, step.message) + "\n\n";
                            for (let answer of answers[fromScope]) {
                                message = message + answer.message + '>> ' + answer.answer + "\n\n";
                            }
                        }
                    }

                    if (!this.MT.empty(targets)) {
                        for (let name in targets) {
                            if (targets.hasOwnProperty(name) && !this.MT.empty(this.bridges[name])) {
                                let peers = [];
                                if (Array.isArray(targets[name])) {
                                    peers = targets[name];
                                } else {
                                    peers.push(targets[name]);
                                }
                                for (let peer of peers) {
                                    if (this.MT.empty(this.bridges[name])) {
                                        console.error('WRONG TRANSPORT NAME ' + name + ' IN ACTION BLOCK');
                                        continue;
                                    }
                                    let parcel = new this.config.classes.Parcel();
                                    peer = (peer === this.SELF_SEND) ? ctx.Message.sender.id : peer;
                                    parcel.peerId = peer;
                                    parcel.message = message || '';
                                    parcel.keyboard = !this.MT.empty(step.action.keyboard) ? this.bridges[name].kbBuild(step.action.keyboard) : [];
                                    this.bridges[name].send(parcel);
                                }
                            }
                        }
                    }
                    break;

                case 'method':
                    let path = step.action.name || step.action.value;
                    let method = this.MT.extract(path);
                    if (method) {
                        method(ctx, params);
                    } else {
                        console.error('BOTCMS DO ACTION. METHOD ' + step.action.value + ' NOT FOUND');
                    }
                    break;
            }
        }
    }

    async getStepByCommand (ctx) {
        // console.log('GET STEP BY COMMAND. TYPE OF COMMAND: ', typeof ctx);
        if (typeof ctx.Message.text !== 'string') {
            return undefined;
        }
        for (let i in this.commands) {
            if (!this.commands.hasOwnProperty(i)) {
                continue;
            }
            const path = this.commands[i];
            // console.log('GET STEP BY COMMAND. PATH: ' + path);
            let step = this.Scripts.extract(path);
            if (step !== undefined && !this.MT.empty(step.trigger) && await this.T.checkTrigger(ctx, step.trigger)) {
                console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    async buildAnswer (ctx, step) {
        const Answer = new this.config.classes.Answer(this, ctx, step);
        return Answer.build();
    }

    storeAnswer (step, ctx, answer = {}, pre = false) {
        let store = (pre ? step.store_pre : step.store) || {};
        if (this.MT.empty(store)) {
            return;
        }
        if (store === true) {
            store = {};
        }
        store.thread = store.thread || this.T.extractAnswerThread(step);
        ctx.session.answers = ctx.session.answers || {};
        let cleanOld = store.clean || !this.MT.empty(step['store-clean']) || !this.MT.empty(step['store_clean']);
        if (cleanOld || !(ctx.session.answers[store.thread] instanceof Object)) {
            ctx.session.answers[store.thread] = {};
        }
        let key = store.key || Object.keys(ctx.session.answers[store.thread]).length + 1;
        let answerData = {
            message: step.message,
            answer: ('value' in store) ? store.value : this.MT.extract('Message.text', answer, ''),
        };
        ctx.session.answers[store.thread] = this.MT.setByPath(key, ctx.session.answers[store.thread], answerData);
        console.log('STORE ANSWER. ANSWERS THREAD ' + store.thread + ' UPDATED: ', ctx.session.answers[store.thread]);
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
            };
        });
        // console.log('TIMED OUT. NETWORK %s, METHOD %s', network, method);
    }
}

module.exports = BotCMS;
module.exports.default = BotCMS;