/** Class for Inbound message context
 * @class
 *
 * @property {Object} chat
 * @property {Object} context
 * @property {Object} from
 * @property {Object} message
 * @property {Object} session
 *
 * @property {Function} reply
 *
 * @property {Object} Bridge
 * @property {BotCMS} BC
 */

class Context {
    constructor (params) {
        // console.log(params);
        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                this[key] = params[key];
            }
        }
    }
}

module.exports = Context;
module.exports.default = Context;