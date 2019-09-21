class Context {
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

module.exports = Context;
module.exports.default = Context;