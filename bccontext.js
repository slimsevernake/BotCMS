class BcContext {
    constructor (params) {
        // console.log(params);
        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                this[key] = params[key];
            }
        }
        this.params = params;
    }
}

module.exports = BcContext;
module.exports.default = BcContext;