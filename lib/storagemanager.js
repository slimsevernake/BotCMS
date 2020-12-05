const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');


class StorageManager {
    constructor(BC, ...configs) {
        this.defaults = {
            storage: 'storage.json',
            adapter: 'file',
            serviceKeys: ['__wrapped__', '__actions__', '__chain__', '__index__', '__values__', '$forceUpdate']
        }
        this.BC = BC
        this.config = this.BC.MT.merge(this.defaults, ...configs)
        if (this.config.adapter === 'file') {
            this.adapter = new FileSync(this.config.storage)
            this.store = low(this.adapter)
        } else {
            this.store = this.config.store
        }
        this.serviceKeys = this.config.serviceKeys
    }

    storeGet (key) {
        // console.log('BOTCMS STORAGE MANAGER STORE GET. KEY ' + key);
        let value = this.store.get(key) || null;
        // console.log('BOTCMS STORAGE MANAGER STORE GET. KEY', key, 'VALUE', value);
        return value.__wrapped__[key];
    }

    storeSet (key, value) {
        let primitive = {};
        // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key + ', VALUE ', value);
        for (let k in value) {
            if (value.hasOwnProperty(k) && this.serviceKeys.indexOf(k) === -1) {
                primitive[k] = value[k];
                // console.log('BOTCMS STORAGE MANAGER STORE SET ' + k + ' VALUE ', value[k]);
            }
        }
        // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key + ' FINAL VALUE ', primitive);
        this.store.set(key, primitive).write();
        // console.log('BOTCMS STORAGE MANAGER STORE SET ' + key /*+ ', ALL ', this.store*/);
        return true;
    }
}

module.exports = StorageManager;