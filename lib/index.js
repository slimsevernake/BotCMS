const CronJob = require('cron').CronJob;

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

    /**
     * @param {Object} params
     */
    constructor (params = {networks: []}) {

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


        this.bridges = {};
        this.commands = [];
        this.config = {};
        this.classes = {
            Answer: require('./answer'),
            Attachment: require('./attachment'),
            Context: require('./context'),
            Message: require('./message'),
            Parcel: require('./parcel'),
            Scripts: require('./scripts'),
            Tools: require('./tools'),
        };
        this.defaults = {
            launchDelay: 500,
        };
        this.drivers = {
            tg: './drivers/telegram',
            vk: './drivers/vkontakte',
        };

        for (const type of ['classes', 'defaults', 'drivers']) {
            if (params[type] !== undefined) {
                for (let name in params[type]) {
                    if (params[type].hasOwnProperty(name)) {
                        this[type][name] = params.classes[name];
                    }
                }
            }
        }

        this.T = new this.classes.Tools(this);
        this.Scripts = new this.classes.Scripts(this);

        if (!this.T.empty(params.networks)) {
            for (let network in params.networks) {
                if (!params.networks.hasOwnProperty(network)) {
                    continue;
                }
                let driver = '';
                let driverName = this.T.empty(params.networks[network]['driver']) ? network : params.networks[network]['driver'];
                if (typeof this.drivers[driverName] === 'string') {
                    driver = require(this.drivers[driverName]);
                } else {
                    driver = this.drivers[driverName];
                }
                if (this.T.empty(driver)) {
                    continue;
                }
                let tmp = new driver(this, params.networks[network]);
                if (tmp.isAvailable() === true) {
                    this.bridges[network] = tmp;
                    this.bridges[network].listen();
                }
            }
        }
    }

    loadSchema (schema = {scripts: {}, config:{}, cron: {}}) {
        this.Scripts.load(schema.scripts);
        if (!this.T.empty(schema.config)) {
            this.loadConfig(schema.config);
        }
        if (!this.T.empty(schema.cron)) {
            this.loadCron(schema.cron);
        }
        // for (let network in this.bridges) {
        //     if (!this.bridges.hasOwnProperty(network)) {
        //         continue;
        //     }
        //     this.bridges[network].loadSchema(schema);
        // }
        // console.log(this.scripts);
    }

    loadConfig (config) {
        this.config = config;
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


    async handleUpdate (ctx) {
        console.debug('======================');
        console.debug('=== HANDLE UPDATE ====');
        console.debug('======================');

        console.log('MESSAGE: ' + ctx.Message.text);
        console.log('SESSION: ', ctx.session);

        let path = ctx.session.step && ctx.session.step.hasOwnProperty('scope') ? ctx.session.step.scope :
            (ctx.session.step && ctx.session.step.hasOwnProperty('path') ? ctx.session.step.path : 'c');
        let opts = {};

        let keyboardOptions = this.Scripts.extract(path + '.keyboard.options');
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        // if (this.T.isCommand(ctx. message.text)) {
            let step = this.getStepByCommand(ctx.Message);
            if (step !== undefined) {
                return this.doUpdate(step, ctx, true, opts);
            }
        // }

        step = this.Scripts.extract(path);

        // console.log(step);
        if (step !== undefined) {
            let answer = this.buildAnswer(ctx.Message, step);

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
                if (!this.T.empty(next)) {
                    if (this.T.isChildrenPath(answer.goto)) {
                        for (let key in next) {
                            if (next.hasOwnProperty(key) && this.T.checkTrigger(ctx.message, next[key].trigger)) {
                                return this.doUpdate(next[key], ctx, true, opts);
                            }
                        }
                    } else {
                        return this.doUpdate(next, ctx, true, opts);
                    }
                }
            }
        }
        if (this.T.extract('defaults.action', this.config) === 'help') {
            return this.doUpdate(this.Scripts.extract('c.help'), ctx, false, opts);
        }
    }

    doUpdate (current, ctx, updateSession = true, opts = {}) {

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
            parcel.message = current.message;
            parcel.keyboard = keyboard;
            result = ctx.reply(ctx.context, parcel);
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
            switch (step.action.type) {
                case 'send':
                    let fromScope = this.T.extract('action.options.from_scope', step);
                    let targets = this.T.extract('action.options.target', step);
                    let message = step.message;

                    if (!this.T.empty(fromScope) && !this.T.empty(ctx)) {
                        let answers = ctx.session.answers;
                        if (!this.T.empty(answers[fromScope])) {
                            message = this.T.extract('action.options.message', step) + "\n\n";
                            for (let answer of answers[fromScope]) {
                                message = message + answer.message + "\n" + answer.answer + "\n";
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
                                    parcel.peerId = peer;
                                    parcel.message = message || '';
                                    parcel.keyboard = !this.T.empty(step.keyboard) ? this.bridges[name].kbBuild(step.keyboard) : [];
                                    this.bridges[name].send(parcel);
                                }
                            }
                        }
                    }
            }
        }
    }

    getStepByCommand (command) {
        // console.log('GET STEP BY COMMAND. TYPE OF COMMAND: ', typeof command);
        if (typeof command.text !== 'string') {
            return undefined;
        }
        for (let i in this.commands) {
            if (!this.commands.hasOwnProperty(i)) {
                continue;
            }
            const path = this.commands[i];
            // console.log('GET STEP BY COMMAND. PATH: ' + path);
            let step = this.Scripts.extract(path);
            if (step !== undefined && !this.T.empty(step.trigger) && this.T.checkTrigger(command, step.trigger)) {
                // console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    buildAnswer (Message, step) {
        const Answer = new this.classes.Answer(this, Message, step);
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
            answer: answer.text
        });
    }

    launch (middleware, ...middlewares) {
        let i = 0;
        let bridges = this.bridges;
        for (let network in this.bridges) {
            if (this.bridges.hasOwnProperty(network)) {
                setTimeout((bridge, method, middleware, ...middlewares) => {
                    this.launchNetwork(bridge, middleware, ...middlewares)
                }, this.defaults.launchDelay * i, bridges[network], middleware, ...middlewares);
            }
            i = i + 1;
        }
    }

    launchNetwork(bridge, middleware, ...middlewares) {
        bridge.launch(middleware, ...middlewares);
        // console.log('TIMED OUT. NETWORK %s, METHOD %s', network, method);
    }
}

module.exports = BotCMS;
module.exports.default = BotCMS;