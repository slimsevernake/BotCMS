/** Class for bot answer builder
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 * @property MV{Tools} MT
 */

class Answer {
    constructor (BC, Context, step) {
        this.BC = BC;
        this.T = BC.T;
        this.MT = BC.MT;
        this.Context = Context;
        this.Message = Context.Message;

        this.step = step;
        this.success = false;
        this.help = '';
        this.goto = '';
        this.methods = [];
    }

    async build () {
        await this.validate(this.step);
        const actions = this.success ? this.T.extract('validate.success', this.step) : this.T.extract('validate.failure', this.step);
        this.assignActions(actions);

        // console.log('BUILD ANSWER. OUTPUT: ', this);
        return this;
    }

    async validate () {
        let result = true;
        let validator = this.T.extract('validate.validator', this.step);
        let validatorParams = this.T.extract('validate.validator-params', this.step);
        // console.log('VALIDATOR ', validator);
        if (!this.MT.empty(validator)) {
            switch (validator) {
                case 'none':
                    result = this.MT.empty(this.Message.text);
                    break;

                case 'text':
                    result = typeof this.Message.text === 'string';
                    break;

                case 'email':
                    result = typeof this.Message.text === 'string' && this.Message.text.match(this.T.REGEXP_EMAIL);
                    console.log('CHECK ANSWER. TYPE EMAIL. RESULT: ' + result);
                    break;

                case 'number':
                    let number = parseInt(this.Message.text);
                    result = this.Message.text === number.toString(10);
                    if (result && validatorParams.min !== undefined) {
                        result = number >= validatorParams.min;
                    }
                    if (result && validatorParams.max !== undefined) {
                        result = number <= validatorParams.max;
                    }
                    break;

                case 'photo':
                    result = this.Message.attachments[this.BC.ATTACHMENTS.PHOTO].length > 0;
                    break;

                default:
                    const validatorMethod = this.T.extract(validator);
                    if (!this.MT.empty(validatorMethod)) {
                        result = await validatorMethod(this.Context, this.step, validatorParams);
                    }
            }
        }
        this.success = result;
        return this;
    }

    assignActions (actions) {
        if (!this.MT.empty(actions)) {
            for (const section of ['help', 'methods', 'goto']) {
                if (!this.MT.empty(actions[section])) {
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