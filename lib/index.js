const CronJob = require('cron').CronJob;

class BotCMS {

    constructor (params = {}) {

        this.classes = {
            Answer: require('./answer'),
            Context: require('./context'),
            Parcel: require('./parcel'),
            Tools: require('./tools'),
        };

        this.T = new this.classes.Tools();

        this.config = {};
        this.bridges = {};
        this.schema = {};
        this.scripts = {};
        this.commands = [];
        this.drivers = {
            tg: './drivers/telegram',
            vk: './drivers/vkontakte',
        };
        this.defaults = {
            launchDelay: this.T.extract('defaults.launchDelay', params, 500),
        };

        if (!this.T.empty(params.drivers)) {
            for (const network in params.drivers) {
                if (params.drivers.hasOwnProperty(network)) {
                    this.drivers[network] = params.drivers[network];
                }
            }
        }

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

    loadSchema (schema) {
        this.schema = schema;
        if (!this.T.empty(schema.scripts)) {
            this.scripts = this.loadScript('', schema.scripts);
        }
        if (!this.T.empty(schema.config)) {
            this.loadConfig(schema.config);
        }
        if (!this.T.empty(schema.cron)) {
            this.loadCron(schema.cron);
        }
        for (let network in this.bridges) {
            if (!this.bridges.hasOwnProperty(network)) {
                continue;
            }
            this.bridges[network].loadSchema(schema);
        }
        // console.log(this.scripts);
    }

    loadConfig (config) {
        this.config = config;
    }

    loadScript (parent, script, additional = {}) {
        for (const name in script) {
            if (!script.hasOwnProperty(name)) {
                continue;
            }

            const path = this.T.empty(parent) ? name : parent + '.' + name;
            const isC = this.T.isChildrenPath(path);
            // console.log('LOAD SCRIPT FOR THREAD ' + path);
            if (isC) {
                script[name] = this.loadScript(path, script[name], additional);
                break;
            } else {
                if (!this.T.empty(script[name]['command'])) {
                    this.commands.push(path);
                }
                for (const key in additional) {
                    if (additional.hasOwnProperty(key)) {
                        script[name][key] = additional[key];
                    }
                }
                if (script[name].hasOwnProperty('store'))
                script[name].parent = parent;
                script[name].path = path;
                script[name].isParent = !this.T.empty(script[name]['c']);
                if (script[name].isParent) {
                    script[name]['c'] = this.loadScript(path + '.c', script[name]['c'], additional);
                }
            }
        }
        return script;
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

        console.log('MESSAGE: ' + ctx.message.text);
        console.log('SESSION: ', ctx.session);

        let path = ctx.session.step && ctx.session.step.hasOwnProperty('scope') ? ctx.session.step.scope :
            (ctx.session.step && ctx.session.step.hasOwnProperty('path') ? ctx.session.step.path : 'c');
        let opts = {};

        let keyboardOptions = this.T.extract(path + '.keyboard.options', this.scripts);
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        // if (this.T.isCommand(ctx. message.text)) {
            let step = this.getStepByCommand(ctx.message);
            if (step !== undefined) {
                return this.doUpdate(step, ctx, true, opts);
            }
        // }

        step = this.T.extract(path, this.scripts);

        // console.log(step);
        if (step !== undefined) {
            let answer = this.buildAnswer(ctx.message, step);

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
            //     const helpStep = this.T.extract(helpPath, this.scripts);
                const helpStep = this.T.extract(answer.help, this.scripts);
                if (!this.T.empty(helpStep)) {
                    await this.doUpdate(helpStep, ctx, false, opts);
                }
            // }

            if (!this.T.empty(answer.goto)) {
                const next = this.T.extract(answer.goto, this.scripts);
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
            return this.doUpdate(this.T.extract('c.help', this.scripts), ctx, false, opts);
        }
    }

    doUpdate (current, ctx, updateSession = true, opts = {}) {

        console.log('DO UPDATE. CURRENT: ', current);
        console.log('DO UPDATE. OPTS', opts);
        if (updateSession) {
            ctx.session.step = current;
        }
        let result = null;
        let keyboard = !this.T.empty(current.keyboard) ? ctx.bridge.kbBuild(current.keyboard) : [];
        if (this.T.empty(keyboard)) {
            keyboard = ctx.bridge.kbRemove();
            console.log('DO UPDATE. REMOVE KB');
        }

        this.doAction(current, ctx);

        if (!this.T.empty(current.message)) {
            // keyboard = undefined;
            let sendObject = {
                message: current.message,
                keyboard: keyboard
            };
            result = ctx.reply(ctx.context, sendObject);
        }
        let goto = this.T.extract('goto', current);
        if (!this.T.empty(goto)) {
            // console.log(JSON.stringify(this.schema.scripts));
            let newCurrent = this.T.extract(goto, this.schema.scripts);
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
                                    this.bridges[name].send({
                                        peer_id: peer,
                                        message: message || '',
                                        keyboard: !this.T.empty(step.keyboard) ? this.bridges[name].kbBuild(step.keyboard) : []
                                    })
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
            let step = this.T.extract(path, this.scripts);
            if (step !== undefined && !this.T.empty(step.trigger) && this.T.checkTrigger(command, step.trigger)) {
                // console.log('GET STEP BY COMMAND. FOUND');
                return step;
            }
        }
        return undefined;
    }

    buildAnswer (message, step) {
        let msg = message.text || '';
        let goto = '';
        let result = true;
        let validator = this.T.extract('validate.validator', step);

        let output = {
            success: result,
            methods: [],
            help: '',
            goto: '',
            text: msg,
            attachments: {
                photo: [],
                audio: [],
                file: [],
                doc: [],
                // Ссылки на прикрепленные посты
                wall: [],
                // Товары
                market: [],
                // Опросы
                poll: [],
                sticker: [],
            }
        };

        console.log(message.attachments);
        if (!this.T.empty(message.attachments)) {
            for (let attachment of message.attachments) {
                // console.log('BUILD ANSWER. ATTACHMENT: ', message.attachments[i]);
                // if (message.attachments[i] === undefined) {
                //     continue;
                // }
                let type = attachment.type;
                if (Array.isArray(output.attachments[type])) {
                    output.attachments[type].push(attachment[type]);
                }
            }
        }

        if (!this.T.empty(validator)) {
            switch (validator) {
                case 'none':
                    result = message.text || '';
                    break;

                case 'text':
                    result = message.type === 'text';
                    break;

                case 'email':
                    result = message.type === 'text' && message.text.match(this.T.REGEXP_EMAIL);
                    console.log('CHECK ANSWER. TYPE EMAIL. RESULT: ' + result);
                    break;

                case 'number':
                    result = message.type === 'text' && parseInt(message.text).toString(10);
                    break;

                case 'photo':
                    result = output.attachments.photo.length > 0;
                    break;

                default:
                    const validatorMethod = this.T.extract(validator);
                    if (!this.T.empty(validatorMethod)) {
                        result = validatorMethod(message, step, this.T.extract('validate.validator-params', step));
                    }
            }
        }

        output.success = result;
        const actions = result ? this.T.extract('validate.success', step) : this.T.extract('validate.failure', step);

        if (!this.T.empty(actions)) {
            for (const section of ['help', 'methods', 'goto']) {
                if (!this.T.empty(actions[section])) {
                    if (Array.isArray(actions[section])) {
                        output[section].push = actions[section];
                    } else {
                        output[section] = actions[section];
                    }
                }
            }
        }

        console.log('BUILD ANSWER. OUTPUT: ', output);
        return output;
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