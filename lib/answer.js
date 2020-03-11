/** Class for bot answer builder
 * @class
 * @deprecated
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
        /** @deprecated */
        this.success = false;
        this.help = '';
        this.goto = '';
        this.methods = [];
    }

    async build () {
        let validator = this.MT.extract('validate', this.step, {});
        let actions = await this.T.processGotos(this.Context, validator);
        for (let key in actions) {
            if (actions.hasOwnProperty(key)) {
                this[key] = actions[key];
            }
        }

        // console.log('BUILD ANSWER. OUTPUT: ', this);
        return this;
    }


}

module.exports = Answer;
module.exports.default = Answer;