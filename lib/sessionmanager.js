const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const StorageManager = require('./storagemanager')


class SessionManager extends StorageManager {
    constructor(BC, config = {}) {
        let defaults = {
            storage: 'sessions.json',
            getStorageKey: (context => (String(context.Bridge.name) + ':' + String(context.Message.chat.id) + ':' + String(context.Message.sender.id))),
            targetKey: 'session',
            storageHandler: {
                set: (key, value) => this.storeSet(key, value),
                get: (key) => this.storeGet(key),
                delete: (key) => this.storeSet(key, {}),
            },
        }
        super(BC, defaults, config)
        this.targetKey = this.config.targetKey
        this.getStorageKey = this.config.getStorageKey
        this.storageHandler = this.config.storageHandler

        this.middleware = (target) => {
            const {storageHandler, targetKey, getStorageKey} = this;
            return next => async () => {
                // console.log(context);
                const storageKey = getStorageKey(target);
                // console.log(storageKey);
                if (storageKey === '') {
                    return next()
                }
                let changed = false;
                const wrapSession = (targetRaw) => (
                    // eslint-disable-next-line no-use-before-define
                    new Proxy({...targetRaw, $forceUpdate}, {
                        set: (target, prop, value) => {
                            // console.log('SESSION SET. KEY', prop, 'VALUE', value)
                            changed = true;
                            target[prop] = value;
                            return true;
                        },
                        deleteProperty(target, prop) {
                            changed = true;
                            delete target[prop];
                            return true;
                        }
                    }));
                const $forceUpdate = () => {
                    // eslint-disable-next-line no-use-before-define
                    if (Object.keys(session).length > 1) {
                        changed = false;
                        // eslint-disable-next-line no-use-before-define
                        return storageHandler.set(storageKey, session);
                    }
                    return storageHandler.delete(storageKey);
                };
                const initialSession = await storageHandler.get(storageKey) || {};
                let session = wrapSession(initialSession);
                Object.defineProperty(target, targetKey, {
                    get: () => session,
                    set: (newSession) => {
                        // console.log('BOTCMS SESSION MANAGER. NEW SESSION: ', newSession);
                        session = wrapSession(newSession);
                        changed = true;
                    }
                });
                await next()
                if (!changed) {
                    return;
                }
                await $forceUpdate();
            };
        }
    }

    storeGet (key) {
        // console.log('BOTCMS SESSION MANAGER STORE GET. KEY ' + key);
        let value = this.store.get(key) || null;
        // console.log('BOTCMS SESSION MANAGER STORE GET. KEY', key, 'VALUE', value);
        return value.__wrapped__[key];
    }

    storeSet (key, value) {
        let primitive = {};
        // console.log('BOTCMS SESSION MANAGER STORE SET ' + key + ', VALUE ', value);
        for (let k in value) {
            if (value.hasOwnProperty(k) && this.serviceKeys.indexOf(k) === -1) {
                primitive[k] = value[k];
                // console.log('BOTCMS SESSION MANAGER STORE SET ' + k + ' VALUE ', value[k]);
            }
        }
        // console.log('BOTCMS SESSION MANAGER STORE SET ' + key + ' FINAL VALUE ', primitive);
        this.store.set(key, primitive).write();
        // console.log('BOTCMS SESSION MANAGER STORE SET ' + key /*+ ', ALL ', this.store*/);
        return true;
    }
}

module.exports = SessionManager;