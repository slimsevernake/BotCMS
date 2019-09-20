const drivers = {
    tg: require('./telegram'),
    vk: require('./vkontakte'),
};


class BotCMS {

    constructor (params = {}) {

        this.REGEXP_EMAIL = /^[\w-\.]+@[\w-]+\.[a-z]{2,4}$/i;

        this.bridges = {};
        this.schema = {};
        this.scripts = {};
        this.commands = [];
        this.T = new BotCMSTools();
        this.defaultStep = {
            trigger: {
                type: 'text',
                value: ''
            },
            command: false,
            message: '',
            answers: {
                store: false,
                action: 'wait'
            },
            forceGoto: false,
        };

        for (let network in params) {
            if (!params.hasOwnProperty(network)) {
                continue;
            }
            if (drivers[network] === undefined) {
                continue;
            }
            let tmp = new drivers[network](this, params[network]);
            if (tmp.isAvailable() === true) {
                this.bridges[network] = tmp;
                this.bridges[network].listen();
            }
        }
    }

    loadSchema (schema) {
        this.schema = schema;
        if (!this.T.empty(schema.scripts)) {
            this.scripts = this.loadScript('', schema.scripts);
        }
        for (let network in this.bridges) {
            if (!this.bridges.hasOwnProperty(network)) {
                continue;
            }
            this.bridges[network].loadSchema(schema);
        }
        // console.log(this.scripts);
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

    async handleUpdate (ctx) {
        console.debug('======================');
        console.debug('=== HANDLE UPDATE ====');
        console.debug('======================');

        console.log('MESSAGE: ' + ctx.message.text);

        let path = ctx.session.step && ctx.session.step.hasOwnProperty('scope') ? ctx.session.step.scope :
            (ctx.session.step && ctx.session.step.hasOwnProperty('path') ? ctx.session.step.path : 'c');
        let opts = {};

        let keyboardOptions = this.T.extract(path + '.keyboard.options', this.scripts);
        opts.kbRemove = Array.isArray(keyboardOptions) && keyboardOptions.indexOf('oneTime') > -1;

        // console.log('COMMANDS PATH: ', this.commands);
        if (this.T.isCommand(ctx. message.text)) {
            let step = this.getStepByCommand(ctx.message);
            if (step !== undefined) {
                return this.doUpdate(step, ctx, true, opts);
            }
        }

        let step = this.T.extract(path, this.scripts);



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
        return this.doUpdate(this.T.extract('c.help', this.scripts), ctx, false, opts);
    }

    doUpdate (current, ctx, updateSession = true, opts = {}) {

        // console.log('DO UPDATE. CURRENT: ', current);
        // console.log('DO UPDATE. OPTS', opts);
        if (updateSession) {
            ctx.session.step = current;
        }
        let result = null;
        let keyboard = !this.T.empty(current.keyboard) ? ctx.bridge.kbBuild(current.keyboard) : [];
        if (this.T.empty(keyboard)) {
            keyboard = ctx.bridge.kbRemove();
            console.log('DO UPDATE. REMOVE KB');
        }

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
                return this.doUpdate(current, ctx, updateSession);
            }
        }
        return result;
    }

    getStepByCommand (command) {
        for (let i in this.commands) {
            if (!this.commands.hasOwnProperty(i)) {
                continue;
            }
            const path = this.commands[i];
            let step = this.T.extract(path, this.scripts);
            if (step !== undefined && !this.T.empty(step.trigger) && this.T.checkTrigger(command, step.trigger)) {
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
        };

        if (!this.T.empty(validator)) {
            switch (validator) {
                case 'none':
                    result = message.text || '';
                    break;

                case 'text':
                    result = message.type === 'text';
                    break;

                case 'email':
                    result = message.type === 'text' && message.text.match(this.REGEXP_EMAIL);
                    console.log('CHECK ANSWER. TYPE EMAIL. RESULT: ' + result);
                    break;

                case 'number':
                    result = message.type === 'text' && parseInt(message.text).toString(10);
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

        // console.log('BUILD ANSWER. OUTPUT: ', output);
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



    standard (method, middleware, ...middlewares) {
        // let fn = arguments.callee.name;
        for (let network in this.bridges) {
            if (this.bridges.hasOwnProperty(network)) {
                // console.log(this.bridges[network]);
                this.bridges[network][method](middleware, ...middlewares);
            }
        }
    }

    start (middleware, ...middlewares) {
        this.standard('start', middleware, ...middlewares);
    }

    help (middleware, ...middlewares) {
        this.standard('help', middleware, ...middlewares);
    }

    on (middleware, ...middlewares) {
        this.standard('on', middleware, ...middlewares);
    }

    command (middleware, ...middlewares) {
        this.standard('command', middleware, ...middlewares);
    }

    hear (middleware, ...middlewares) {
        this.standard('hear', middleware, ...middlewares);
    }

    launch (middleware, ...middlewares) {
        this.standard('launch', middleware, ...middlewares);
    }
}

class BotCMSTools {
    constructor (BC) {
        this.BC = BC;
    }

    empty (variable) {
        return variable === undefined
            || variable === null
            || variable === false
            || variable === ''
            || (Array.isArray(variable) && variable.length === 0);
    }

    isArray (data) {
        console.log('IS ARRAY. TYPE: ' + Object.prototype.toString.call(data));
        return Object.prototype.toString.call(data) === '[object Array]'
    }

    isString (data) {
        return (typeof data === "string" || data instanceof String);
    }

    inArray (value, array) {
        for(var i = 0; i < array.length; i++){
            if(value === array[i]) {
                return true;
            }
        }
        return false;
    }

    isCommand (value) {
        return typeof value === "string" && value.startsWith('/');
    }

    isChildrenPath (path) {
        return path.endsWith('.c') || path === 'c';
    }

    checkTrigger (message, triggerObject) {
        let trigger = null;
        let result = false;
        if (!this.empty(triggerObject) && triggerObject.hasOwnProperty('type')) {
            if (triggerObject.type === 'text' && message.type === 'text') {
                // console.log('CHECK TRIGGER. TYPE TEXT');
                trigger = triggerObject.value;
                if (Array.isArray(trigger)) {
                    result = trigger.indexOf(message.text) > -1;
                    // result = this.inArray(message.text, trigger);
                    // console.log('CHECK TRIGGER. IS ARRAY');
                } else {
                    result = trigger === message.text.toString();
                    // console.log('CHECK TRIGGER. IS STRING');
                }
            }

            if (triggerObject.type === 'regexp' && message.type === 'text') {
                trigger = new RegExp(triggerObject.value, 'gim');
                result = message.text.toString().search(trigger) !== -1;
            }

            if (triggerObject.type === 'method') {
                let func = 'myObj.method.myFunc';
                let path = func.split('.');
                trigger = window;
                for (let i in path) {
                    trigger = trigger[path[i]];
                }
            }
            // console.log('CHECK TRIGGER. message, result, trigger', message, result, triggerObject);
        }
        return result;
    }

    extract (path, target = window) {
        path = path.split('.');
        while (path.length > 0) {
            let step = path.shift();
            if (!this.empty(target) && target.hasOwnProperty(step)) {
                target = target[step];
            } else {
                return undefined;
            }
        }
        return target;
    }

    extractAnswerThread (path) {
        const pathParts = path.split('.');
        return !this.empty(pathParts[1]) ? pathParts[1] : undefined;
    }



}

module.exports = BotCMS;
module.exports.default = BotCMS;