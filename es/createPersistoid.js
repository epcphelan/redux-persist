/* eslint-disable @typescript-eslint/no-explicit-any */
import { KEY_PREFIX } from './constants';
export default function createPersistoid(config) {
    // defaults
    const blacklist = config.blacklist || null;
    const whitelist = config.whitelist || null;
    const transforms = config.transforms || [];
    const throttle = config.throttle || 0;
    const storageKey = `${config.keyPrefix !== undefined ? config.keyPrefix : KEY_PREFIX}${config.key}`;
    const storage = config.storage;
    let serialize;
    if (config.serialize === false) {
        serialize = (x) => x;
    }
    else if (typeof config.serialize === 'function') {
        serialize = config.serialize;
    }
    else {
        serialize = defaultSerialize;
    }
    const writeFailHandler = config.writeFailHandler || null;
    // initialize stateful values
    let lastState = {};
    const stagedState = {};
    const keysToProcess = [];
    let writeTimeout = null;
    let writePromise = null;
    const update = (state) => {
        // add any changed keys to the queue
        Object.keys(state).forEach(key => {
            if (!passWhitelistBlacklist(key))
                return; // is keyspace ignored? noop
            if (lastState[key] === state[key])
                return; // value unchanged? noop
            if (keysToProcess.indexOf(key) !== -1)
                return; // is key already queued? noop
            keysToProcess.push(key); // add key to queue
        });
        //if any key is missing in the new state which was present in the lastState,
        //add it for processing too
        Object.keys(lastState).forEach(key => {
            if (state[key] === undefined &&
                passWhitelistBlacklist(key) &&
                keysToProcess.indexOf(key) === -1 &&
                lastState[key] !== undefined) {
                keysToProcess.push(key);
            }
        });
        if (!throttle) {
            flush();
        }
        else if (writeTimeout === null) {
            // start the time iterator if not running (read: throttle)
            writeTimeout = setTimeout(flush, throttle);
        }
        lastState = state;
    };
    function processNextKey() {
        if (keysToProcess.length === 0) {
            return;
        }
        const key = keysToProcess.shift();
        if (key === undefined) {
            return;
        }
        const endState = transforms.reduce((subState, transformer) => {
            return transformer.in(subState, key, lastState);
        }, lastState[key]);
        if (endState !== undefined) {
            try {
                stagedState[key] = serialize(endState);
            }
            catch (err) {
                console.error('redux-persist/createPersistoid: error serializing state', err);
            }
        }
        else {
            //if the endState is undefined, no need to persist the existing serialized content
            delete stagedState[key];
        }
        if (keysToProcess.length === 0) {
            writeStagedState();
        }
    }
    function writeStagedState() {
        // cleanup any removed keys just before write.
        Object.keys(stagedState).forEach(key => {
            if (lastState[key] === undefined) {
                delete stagedState[key];
            }
        });
        writePromise = storage
            .setItem(storageKey, serialize(stagedState))
            .catch(onWriteFail);
    }
    function passWhitelistBlacklist(key) {
        if (whitelist && whitelist.indexOf(key) === -1 && key !== '_persist')
            return false;
        if (blacklist && blacklist.indexOf(key) !== -1)
            return false;
        return true;
    }
    function onWriteFail(err) {
        // @TODO add fail handlers (typically storage full)
        if (writeFailHandler)
            writeFailHandler(err);
        if (err && process.env.NODE_ENV !== 'production') {
            console.error('Error storing data', err);
        }
    }
    function flush() {
        while (keysToProcess.length !== 0) {
            processNextKey();
        }
        if (writeTimeout) {
            clearTimeout(writeTimeout);
            writeTimeout = null;
        }
        return writePromise || Promise.resolve();
    }
    // return `persistoid`
    return {
        update,
        flush,
    };
}
// @NOTE in the future this may be exposed via config
function defaultSerialize(data) {
    return JSON.stringify(data);
}
