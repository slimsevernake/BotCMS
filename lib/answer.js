/** Class for bot answer builder
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Answer {
    constructor (BC, Message, step) {
        this.BC = BC;
        this.T = BC.T;
        this.Message = Message;

        this.step = step;
        this.success = false;
        this.help = '';
        this.goto = '';
        this.methods = [];
    }

    build () {
        this.validate(this.step);
        const actions = this.success ? this.T.extract('validate.success', this.step) : this.T.extract('validate.failure', this.step);
        this.assignActions(actions);

        // console.log('BUILD ANSWER. OUTPUT: ', this);
        return this;
    }

    validate () {
        let result = true;
        let validator = this.T.extract('validate.validator', this.step);
        // console.log('VALIDATOR ', validator);
        if (!this.T.empty(validator)) {
            switch (validator) {
                case 'none':
                    result = this.T.empty(this.Message.text);
                    break;

                case 'text':
                    result = typeof this.Message.text === 'string';
                    break;

                case 'email':
                    result = typeof this.Message.text === 'string' && this.Message.text.match(this.T.REGEXP_EMAIL);
                    console.log('CHECK ANSWER. TYPE EMAIL. RESULT: ' + result);
                    break;

                case 'number':
                    result = this.Message.text === parseInt(this.Message.text).toString(10);
                    break;

                case 'photo':
                    result = this.Message.attachments[this.BC.ATTACHMENTS.PHOTO].length > 0;
                    break;

                default:
                    const validatorMethod = this.T.extract(validator);
                    if (!this.T.empty(validatorMethod)) {
                        result = validatorMethod(this.Message, this.step, this.T.extract('validate.validator-params', this.step));
                    }
            }
        }
        this.success = result;
        return this;
    }

    assignActions (actions) {
        if (!this.T.empty(actions)) {
            for (const section of ['help', 'methods', 'goto']) {
                if (!this.T.empty(actions[section])) {
                    if (Array.isArray(actions[section])) {
                        this[section].push = actions[section];
                    } else {
                        this[section] = actions[section];
                    }
                }
            }
        }
    }


}

module.exports = Answer;
module.exports.default = Answer;