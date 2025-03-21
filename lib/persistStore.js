"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redux_1 = require("redux");
const constants_1 = require("./constants");
const initialState = {
    registry: [],
    bootstrapped: false,
};
const persistorReducer = (state = initialState, action) => {
    const firstIndex = state.registry.indexOf(action.key);
    const registry = [...state.registry];
    switch (action.type) {
        case constants_1.REGISTER:
            return Object.assign(Object.assign({}, state), { registry: [...state.registry, action.key] });
        case constants_1.REHYDRATE:
            registry.splice(firstIndex, 1);
            return Object.assign(Object.assign({}, state), { registry, bootstrapped: registry.length === 0 });
        default:
            return state;
    }
};
function persistStore(store, options, cb) {
    // help catch incorrect usage of passing PersistConfig in as PersistorOptions
    if (process.env.NODE_ENV !== 'production') {
        const optionsToTest = options || {};
        const bannedKeys = [
            'blacklist',
            'whitelist',
            'transforms',
            'storage',
            'keyPrefix',
            'migrate',
        ];
        bannedKeys.forEach(k => {
            if (optionsToTest[k])
                console.error(`redux-persist: invalid option passed to persistStore: "${k}". You may be incorrectly passing persistConfig into persistStore, whereas it should be passed into persistReducer.`);
        });
    }
    let boostrappedCb = cb || false;
    const _pStore = redux_1.createStore(persistorReducer, initialState, options && options.enhancer ? options.enhancer : undefined);
    const register = (key) => {
        _pStore.dispatch({
            type: constants_1.REGISTER,
            key,
        });
    };
    const rehydrate = (key, payload, err) => {
        const rehydrateAction = {
            type: constants_1.REHYDRATE,
            payload,
            err,
            key,
        };
        // dispatch to `store` to rehydrate and `persistor` to track result
        store.dispatch(rehydrateAction);
        _pStore.dispatch(rehydrateAction);
        if (typeof boostrappedCb === "function" && persistor.getState().bootstrapped) {
            boostrappedCb();
            boostrappedCb = false;
        }
    };
    const persistor = Object.assign(Object.assign({}, _pStore), { purge: () => {
            const results = [];
            store.dispatch({
                type: constants_1.PURGE,
                result: (purgeResult) => {
                    results.push(purgeResult);
                },
            });
            return Promise.all(results);
        }, flush: () => {
            const results = [];
            store.dispatch({
                type: constants_1.FLUSH,
                result: (flushResult) => {
                    results.push(flushResult);
                },
            });
            return Promise.all(results);
        }, pause: () => {
            store.dispatch({
                type: constants_1.PAUSE,
            });
        }, persist: () => {
            store.dispatch({ type: constants_1.PERSIST, register, rehydrate });
        } });
    if (!(options && options.manualPersist)) {
        persistor.persist();
    }
    return persistor;
}
exports.default = persistStore;
