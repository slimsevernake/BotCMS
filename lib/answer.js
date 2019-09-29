/** Class for bot answer builder
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Answer {
    constructor (BC) {
        this.BC = BC;
        this.T = BC.T;
    }


}

module.exports = Answer;
module.exports.default = Answer;