/** Class for parcel from bot to user
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Parcel {
    constructor (BC) {
        this.BC = BC;
        this.T = BC.T;
    }


}

module.exports = Parcel;
module.exports.default = Parcel;