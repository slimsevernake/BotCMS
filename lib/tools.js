class Tools {

    constructor (BC) {
        this.BC = BC;
        this.MT = this.BC.MT;

        this.REGEXP_EMAIL = /^[\w-\.]+@[\w-]+\.[a-z]{2,4}$/i;
        this.REGEXR_DATE = /^([0-9]{4})+-([0-9]{2}).([0-9]{2})$/;
        this.REGEXR_DATE_RUS = /^([0-9]{2})+.([0-9]{2}).([0-9]{4})$/;
        this.REGEXR_DATETIME = /^([0-9]{4})+-([0-9]{2}).([0-9]{2})\s([0-9]{2}):([0-9]{2}){1,2}$/;
        this.REGEXR_DATETIME_RUS = /^([0-9]{2})+.([0-9]{2}).([0-9]{4})\s([0-9]{2}):([0-9]{2}){1,2}$/;
    }

    empty (variable) {
        return this.MT.empty(variable);
    }

    emptyExtracted (path, target = window) {
        const extracted = this.extract(path, target);
        return this.empty(extracted);
    }

    isArray (data) {
        return Array.isArray(data);
    }

    isString (data) {
        return this.MT.isString(data);
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

    async checkTrigger (ctx, triggerObj) {
        let triggerObject = this.MT.copyObject(triggerObj);
        let message = ctx.Message;
        let type = null;
        let result = true;
        let tmpArray = this.MT.makeArray(triggerObject);

        for (let triggerObject of tmpArray) {
            if (!this.empty(triggerObject)) {

                if (this.MT.isString(triggerObject) || Array.isArray(triggerObject)) {
                    triggerObject = {value: triggerObject};
                }
                result = false;
                type = triggerObject.type;
                let trigger = this.MT.makeArray(triggerObject.value);

                if (type === 'bridge' && trigger.indexOf(ctx.Bridge.name) !== -1) {
                    result = true;
                }

                if (type === 'regexp' && !this.empty(message.text)) {
                    for (let re of triggerObject.value) {
                        trigger = new RegExp(re, 'gim');
                        result = message.text.toString().search(trigger) !== -1;
                        if (result) {
                            break;
                        }
                    }
                }

                if ((this.MT.empty(type) || ['text', 'method'].indexOf(type) > -1) && !this.empty(message.text)) {
                    for (let singleTrigger of trigger) {
                        let method = this.extract(singleTrigger);
                        if (typeof method === 'function') {
                            let params = this.extract('params', triggerObject, {});
                            result = await method(ctx, params);
                        } else {
                            let translatedTrigger = ctx.lexicon(singleTrigger);
                            result = translatedTrigger === message.text;
                        }
                        if (result) {
                            break;
                        }
                    }
                }
                if (!result) {
                    break;
                }
                // console.log('CHECK TRIGGER. message, result, trigger', message, result, triggerObject);
            }
        }
        return result;
    }

    async processGotos (ctx, gotos) {
        let actions = {};
        let result = await this.validate(ctx, gotos);

        if (this.MT.isString(gotos)) {
            gotos = {
                success: gotos,
            }
        }

        if (this.MT.empty(result)) {
            actions = this.MT.extract('failure', gotos, {});
        } else {
            let sw = this.MT.extract('switch', gotos, null);
            if (!this.MT.empty(sw)) {
                let swKey = String(result);
                if (this.MT.empty(ctx) && sw.hasOwnProperty(swKey)) {
                    actions = sw[swKey];
                } else if (!this.MT.empty(ctx)) {
                    let lexiconSwKey = ctx.lexicon(swKey);
                    if (sw.hasOwnProperty(lexiconSwKey)) {
                        actions = sw[lexiconSwKey];
                    } else {
                        for (let key in sw) {
                            if (sw.hasOwnProperty(key)) {
                                if (ctx.msg === ctx.lexicon(key)) {
                                    actions = sw[key];
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (Object.keys(actions).length === 0) {
                actions = this.MT.extract('success', gotos);
                if (this.MT.empty(actions)) {
                    actions = this.MT.extract('failure', gotos, {});
                }
            }
        }

        if (this.MT.isString(actions)) {
            actions = {goto: actions};
        }
        return this.appendActions(actions);
    }

    appendActions (actions) {
        let result = {methods: [], help: '', goto: ''};
        console.log('ASSIGN ACTIONS. ', actions);
        if (!this.MT.empty(actions)) {
            for (let section of Object.keys(result)) {
                if (!this.MT.empty(actions[section])) {
                    if (Array.isArray(actions[section])) {
                        result[section].push = actions[section];
                    } else {
                        result[section] = actions[section];
                    }
                }
            }
        }
        return result;
    }

    async validate (ctx, gotos) {
        let result = true;
        let validator = this.MT.extract('validator', gotos);
        let validatorParams = this.MT.extract('params', gotos);
        if (this.MT.empty(validatorParams)) {
            validatorParams = this.MT.extract('validator-params', gotos);
        }
        // console.log('VALIDATOR ', validator);
        if (!this.MT.empty(validator)) {
            switch (validator) {
                // case 'none':
                //     result = this.MT.empty(this.Message.text);
                //     break;
                //
                // case 'text':
                //     result = typeof this.Message.text === 'string';
                //     break;

                case 'email':
                    result = !this.MT.empty(ctx) && typeof ctx.Message.text === 'string' && ctx.Message.text.match(this.REGEXP_EMAIL);
                    console.log('CHECK ANSWER. TYPE EMAIL. RESULT: ' + result);
                    break;

                case 'number':
                    if (!this.MT.empty(ctx)) {
                        let number = parseInt(ctx.Message.text);
                        result = ctx.Message.text === number.toString(10);
                        if (result && validatorParams.min !== undefined) {
                            result = number >= validatorParams.min;
                        }
                        if (result && validatorParams.max !== undefined) {
                            result = number <= validatorParams.max;
                        }
                    }
                    break;

                case 'photo':
                    result = !this.MT.empty(ctx) && ctx.Message.attachments[this.BC.ATTACHMENTS.PHOTO].length > 0;
                    break;

                case 'values':
                    result = false;
                    validatorParams = this.MT.makeArray(validatorParams);
                    for (let value of validatorParams) {
                        if (ctx.msg === ctx.lexicon(value)) {
                            result = true;
                            break;
                        }
                    }
                    break;

                case 'date':
                    result = !this.MT.empty(ctx) && typeof ctx.Message.text === 'string'
                        && (this.REGEXR_DATE.exec(ctx.Message.text) !== null || this.REGEXR_DATE_RUS.exec(ctx.Message.text) !== null);
                    break;

                case 'datetime':
                    result = !this.MT.empty(ctx) && typeof ctx.Message.text === 'string'
                        && (this.REGEXR_DATETIME.exec(ctx.Message.text) !== null || this.REGEXR_DATETIME_RUS.exec(ctx.Message.text) !== null);
                    break;

                default:
                    const validatorMethod = this.MT.extract(validator);
                    if (typeof validatorMethod === 'function') {
                        result = await validatorMethod(ctx, gotos, validatorParams);
                    }
            }
        }
        return result;
    }

    extract (path, target = process, def = undefined) {
        return this.MT.extract(path, target, def);
    }

    extractAnswerThread (step) {
        const pathParts = step.path.split('.');
        return !this.empty(pathParts[1]) ? pathParts[1] : undefined;
    }

    execMessage (message, ctx) {
        let method = this.MT.extract(message);
        if (!this.empty(method)) {
            message = method(ctx);
        }
        return message;
    }

    flipObject (object) {
        return this.MT.flipObject(object);
    }

    random (min = 0, max = 1) {
        return this.MT.random(min, max);
    }

}

module.exports = Tools;
module.exports.default = Tools;