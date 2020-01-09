const MVTools = require('mvtools');
const CronJob = require('cron').CronJob;
const {MiddlewareManager} = require('js-middleware');
const {createConnection, BaseEntity} = require("typeorm");

/**
 * BotCMS is a simple way to use bots at most popular networks from one point
 * @class
 *
 * @property {Object} bridges
 * @property {Object} classes
 * @property {Object} config
 * @property {Object} defaults
 * @property {Object} drivers
 * @property {Object} schema
 *
 * @property {Tools} T
 * @property {Scripts} Scripts
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
            Message: require('./message'),
            Parcel: require('./parcel'),
            Scripts: require('./scripts'),
            Tools: require('./tools'),
        },
        db: {},
        drivers: {
            tg: './drivers/telegram',
            vk: './drivers/vkontakte',
        },
        launchDelay: 500,
        loaders: ['keyboards', 'scripts', 'config', 'cron', 'middlewares'],
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
        this.setConfig(config);

        /** @TODO Исключить использование устаревших свойств класса */
        this.classes = this.config.classes;

        this.T = new this.classes.Tools(this);
        this.Scripts = new this.classes.Scripts(this);
        this.MiddlewareManager = new MiddlewareManager(this);
        this.DB = null;

        this.useMultiple(this.config.middlewareMethods);
    }

    setConfig (config) {
        this.config = this.MT.merge(this.defaults, this.config, config);
    }

    async loadSchema (schema = {}) {
        schema = this.MT.readConfig(schema, this.BINDINGS.FILE, true);
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
        this.setConfig(config);
    }

    loadKeyboards (keyboards) {
        this.keyboards = keyboards;
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
        let job = new CronJob(jobData.trigger.value, () => this.processCronJob((jobData)), () => {}, false, 'Atlantic/Reykjavik');
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
                this.use(middleware);
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
            if (!this.T.empty(step)) {
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
        if (!this.T.empty(networks)) {
            for (let network in networks) {
                if (!networks.hasOwnProperty(network)) {
                    continue;
                }
                promises.push( (async () => {
                    let name = networks[network]['name'] ? networks[network]['name'] : network;
                    let driver = '';
                    let driverName = this.T.empty(networks[network]['driver']) ? name : networks[network]['driver'];
                    if (typeof this.config.drivers[driverName] === 'string') {
                        driver = require(this.config.drivers[driverName]);
                    } else {
                        driver = this.config.drivers[driverName];
                    }
                    if (this.T.empty(driver)) {
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
        if (!this.T.empty(this.config.db.type)) {
            for (let i in this.config.db.entities) {
                if (this.config.db.entities.hasOwnProperty(i) && typeof this.config.db.entities[i] === "string") {
                    this.config.db.entities[i] = this.config.db.entities[i].replace(process.cwd() + '/', '');
                }
            }
            this.DB = await createConnection(this.config.db).then(connection => {
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
        // if (this.T.isCommand(ctx. message.text)) {
            let step = await this.getStepByCommand(ctx);
            if (step !== undefined) {
                return this.doUpdate(step, ctx, true, opts);
            }
        // }

        step = this.Scripts.extract(path);

        // console.log(path);
        // console.log(step);
        if (step !== undefined) {
            let answer = await this.buildAnswer(ctx, step);

            if (!this.T.empty(step.store)) {
                this.storeAnswer(answer, step, ctx, !this.T.empty(step['store-clean']));
            }

            for (let method of answer.methods) {
                method = this.T.extract(method);
                if (!this.T.empty(method)) {
                    await method(answer, ctx);
                }
            }
            // for (let helpPath of answer.help) {
            //     const helpStep = this.Scripts.extract(helpPath);
                const helpStep = this.Scripts.extract(answer.help);
                if (!this.T.empty(helpStep)) {
                    await this.doUpdate(helpStep, ctx, false, opts);
                }
            // }

            if (!this.T.empty(answer.goto)) {
                const next = this.Scripts.extract(answer.goto);
                console.info('BOTCMS HANDLE UPDATE. NEXT STEP: ', next);
                if (!this.T.empty(next)) {
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
        if (!ctx.isProcessed && this.T.extract('defaults.action', this.config) === 'help') {
            return this.doUpdate(this.Scripts.extract('c.help'), ctx, false, opts);
        }
    }

    async doUpdate (current, ctx, updateSession = true, opts = {}) {

        // console.log('DO UPDATE. CURRENT: ', current);
        // console.log('DO UPDATE. OPTS', opts);
        if (updateSession) {
            ctx.session.step = current;
        }
        let result = null;
        let keyboard = !this.T.empty(current.keyboard) ? ctx.Bridge.kbBuild(current.keyboard) : [];
        if (this.T.empty(keyboard)) {
            keyboard = ctx.Bridge.kbRemove();
            // console.log('DO UPDATE. REMOVE KB');
        }

        this.doAction(current, ctx);

        if (!this.T.empty(current.message)) {
            let parcel = new this.classes.Parcel();
            parcel.message = await this.T.execMessage(current.message, ctx);
            parcel.peerId = ctx.Message.chat.id;
            parcel.keyboard = keyboard;
            parcel.attachments = current.attachments || {};
            result = ctx.reply(parcel);
        }
        let goto = this.T.extract('goto', current);
        if (!this.T.empty(goto)) {
            // console.log(JSON.stringify(this.schema.scripts));
            let newCurrent = this.Scripts.extract(goto);
            // console.log(JSON.stringify(this.schema.scripts));
            if (!this.T.empty(newCurrent)) {
                if (result) {
                    return result.then(() => {this.doUpdate(newCurrent, ctx, updateSession)});
                }
                return this.doUpdate(newCurrent, ctx, updateSession);
            }
        }
        return result;
    }

    doAction(step, ctx = undefined) {
        if (!this.T.empty(step.action)) {
            // console.log('BOTCMS DO ACTION. ACTION: ', step.action);
            switch (step.action.type) {
                case 'send':
                    let fromScope = this.T.extract('action.options.from_scope', step);
                    let targets = this.T.extract('action.options.target', step);
                    let message = this.T.execMessage(step.message, ctx);

                    if (!this.T.empty(fromScope) && !this.T.empty(ctx)) {
                        let answers = ctx.session.answers;
                        if (!this.T.empty(answers[fromScope])) {
                            message = this.T.extract('action.options.message', step) + "\n\n";
                            for (let answer of answers[fromScope]) {
                                message = message + answer.message + '>> ' + answer.answer + "\n\n";
                            }
                        }
                    }

                    if (!this.T.empty(targets)) {
                        for (let name in targets) {
                            if (targets.hasOwnProperty(name) && !this.T.empty(this.bridges[name])) {
                                let peers = [];
                                if (Array.isArray(targets[name])) {
                                    peers = targets[name];
                                } else {
                                    peers.push(targets[name]);
                                }
                                for (let peer of peers) {
                                    if (this.T.empty(this.bridges[name])) {
                                        console.error('WRONG TRANSPORT NAME ' + name + ' IN ACTION BLOCK');
                                        continue;
                                    }
                                    let parcel = new this.classes.Parcel();
                                    peer = (peer === this.SELF_SEND) ? ctx.Message.sender.id : peer;
                                    parcel.peerId = peer;
                                    parcel.message = message || '';
                                    parcel.keyboard = !this.T.empty(step.action.keyboard) ? this.bridges[name].kbBuild(step.action.keyboard) : [];
                                    this.bridges[name].send(parcel);
                                }
                            }
                        }
                    }
                    break;

                case 'method':
                    let func = this.T.extract(step.action.value);
                    if (func) {
                        func(ctx);
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
            if (step !== undefined && !this.T.empty(step.trigger) && await this.T.checkTrigger(ctx, step.trigger)) {
                console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    async buildAnswer (ctx, step) {
        const Answer = new this.classes.Answer(this, ctx, step);
        return Answer.build();
    }

    storeAnswer (answer, step, ctx, cleanOld = false) {
        const thread = this.T.extractAnswerThread(step.path);
        ctx.session.answers = ctx.session.answers || {};
        ctx.session.answers[thread] = ctx.session.answers[thread] || [];
        if (cleanOld) {
            ctx.session.answers[thread] = [];
        }
        ctx.session.answers[thread].push({
            message: step.message,
            answer: answer.Message.text
        });
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
            if (this.T.extract('notifyLaunch.bridge', this.config) === bridge.name) {
                let parcel = new this.classes.Parcel();
                parcel.peerId = this.T.extract('notifyLaunch.peerId', this.config);
                parcel.message = this.T.extract('notifyLaunch.message', this.config);
                bridge.send(parcel);
            };
        });
        // console.log('TIMED OUT. NETWORK %s, METHOD %s', network, method);
    }
}

module.exports = BotCMS;
module.exports.default = BotCMS;