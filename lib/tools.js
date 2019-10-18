class Tools {

    constructor (BC) {
        this.BC = BC;

        this.REGEXP_EMAIL = /^[\w-\.]+@[\w-]+\.[a-z]{2,4}$/i;
    }

    empty (variable) {
        return variable === undefined
            || variable === null
            || variable === false
            || variable === ''
            || (Array.isArray(variable) && variable.length === 0);
    }

    emptyExtracted (path, target = window) {
        const extracted = this.extract(path, target);
        return this.empty(extracted);
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

    checkTrigger (ctx, triggerObject) {
        let message = ctx.Message;
        let trigger = null;
        let result = false;
        let tmpArray = triggerObject;
        if (!Array.isArray(tmpArray)) {
            tmpArray = [ triggerObject ];
        }
        for (triggerObject of tmpArray) {
            if (!this.empty(triggerObject) && triggerObject.hasOwnProperty('type')) {
                if (triggerObject.type === 'text' && !this.empty(message.text)) {
                    // console.log('CHECK TRIGGER. TYPE TEXT');
                    trigger = triggerObject.value;
                    if (Array.isArray(trigger)) {
                        result = trigger.indexOf(message.text) > -1;
                        // result = this.inArray(message.text, trigger);
                        // console.log('CHECK TRIGGER. IS ARRAY');
                    } else {
                        result = trigger === message.text;
                        // console.log('CHECK TRIGGER. IS STRING');
                    }
                }

                if (triggerObject.type === 'regexp' && !this.empty(message.text)) {
                    if (Array.isArray(triggerObject.value)) {
                        for (const re of triggerObject.value) {
                            trigger = new RegExp(re, 'gim');
                            result = message.text.toString().search(trigger) !== -1;
                            if (result) {
                                break;
                            }
                        }
                        console.log('CHECK TRIGGER. IS ARRAY');
                    } else {
                        console.log('CHECK TRIGGER. IS STRING');
                        trigger = new RegExp(triggerObject.value, 'gim');
                        result = message.text.toString().search(trigger) !== -1;
                    }
                }

                if (triggerObject.type === 'method') {
                    let func = this.extract(triggerObject.value);
                    if (func) {
                        result = func(ctx);
                    }
                }
                // console.log('CHECK TRIGGER. message, result, trigger', message, result, triggerObject);
            }
            if (!result) {
                break;
            }
        }
        return result;
    }

    extract (path, target = process, def = undefined) {
        path = path.split('.');
        while (path.length > 0) {
            let step = path.shift();
            if (!this.empty(target) && target.hasOwnProperty(step)) {
                target = target[step];
            } else {
                return def;
            }
        }
        return target;
    }

    extractAnswerThread (path) {
        const pathParts = path.split('.');
        return !this.empty(pathParts[1]) ? pathParts[1] : undefined;
    }

}

module.exports = Tools;
module.exports.default = Tools;