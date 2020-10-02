/**
 * @class
 * @property {import('./botcms.js')} BC
 * @property {import('./botcms.js').MVTools} MT
 * @property {Object} REGEXP_EMAIL
 * @property {Object} REGEXP_DATE
 * @property {Object} REGEXP_DATE_RUS
 * @property {Object} REGEXP_DATETIME
 * @property {Object} REGEXP_DATETIME_RUS
 *
 */

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

    /**
     * Check if variable has an empty value. Wrapper for MVTools.empty()
     * @param variable
     * @return {boolean}
     */
    empty (variable) {
        return this.MT.empty(variable);
    }

    emptyExtracted (path, target = window) {
        const extracted = this.extract(path, target);
        return this.empty(extracted);
    }

    isString (data) {
        return this.MT.isString(data);
    }

    /**
     * Check if value is command (starts with a '/')
     * @param {string} value
     * @return {boolean}
     */
    isCommand (value) {
        return typeof value === "string" && value.startsWith('/');
    }

    /**
     * Check if path of scripts marked as a children (ends with .c)
     * @param {string} path
     * @return {boolean}
     */
    isChildrenPath (path) {
        return path.endsWith('.c') || path === 'c';
    }

    /**
     * Check message is equal to trigger
     * @param {import('./context.js')} ctx
     * @param {Object<string, string|string[]||Object<string, string>|string[]>} triggerObj
     * @return {Promise<boolean>}
     */
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
                let params = this.extract('params', triggerObject, {});
                let triggers = this.MT.makeArray(triggerObject.value);

                if (type === 'bridge') {
                    result = triggers.indexOf(ctx.Bridge.name) !== -1
                }

                if (type === 'driver') {
                    result = triggers.indexOf(ctx.Bridge.driverName) !== -1
                }

                if (type === 'event') {
                    result = triggers.indexOf(message.event) !== -1
                }

                if (type === 'regexp' && !this.empty(message.text)) {
                    for (let re of triggerObject.value) {
                        let trigger = new RegExp(re, 'gim');
                        result = message.text.toString().search(trigger) !== -1;
                        if (result) {
                            break;
                        }
                    }
                }

                if (type === 'callback' && !this.empty(message.data)) {
                    let callback = typeof message.data === 'string' ? message.data : ''
                    for (let trigger of triggers) {
                        if (trigger.endsWith('*')) {
                            result = callback.startsWith(trigger.substr(0, trigger.length - 1))
                        } else {
                            result = callback === trigger
                        }
                    }
                }

                if ((this.MT.empty(type) || ['text', 'method'].indexOf(type) > -1)) {
                    for (let trigger of triggers) {
                        let method = this.extract(trigger);
                        if (typeof method === 'function') {
                            result = await method(ctx, params);
                        } else if (!this.empty(message.text)) {
                            let translatedTrigger = ctx.lexicon(trigger);
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
                // console.log('CHECK TRIGGER. message, result, triggers', message, result, triggerObject);
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
                                if (ctx.msg === key || ctx.msg === ctx.lexicon(key)) {
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
        // console.log('ASSIGN ACTIONS. ', actions);
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