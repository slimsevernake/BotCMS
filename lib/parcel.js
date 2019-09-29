/** Class for parcel from bot to user
 * @class
 *
 * @property {Object} _scripts
 *
 * @property {BotCMS} BC
 * @property {Tools} T
 */

class Parcel {
    constructor (/*BC*/) {
        // this.BC = BC;
        // this.T = BC.T;

        this.keyboard = {
            buttons: [],
            options: [],
        };
        this.message = '';
        this.peerId = '';
        this.attachments = {

        };

    }


}

module.exports = Parcel;
module.exports.default = Parcel;