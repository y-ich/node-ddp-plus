/* global exports */
const DDPClient = require('ddp');

async function sleep(time) {
    return new Promise(function(res, rej) {
        setTimeout(res, time);
    });
}

class DDPPlus extends DDPClient {
    constructor(config) {
        super(config);
        this.retryTime = 1000;
        this.handlers = {
            'socket-close': [],
            'socket-error': [],
            'connect-error': [],
            'connect-success': []
        };
        this.on('socket-close', (code, message) => {
            for (const e of this.handlers['socket-close']) {
                e(code, message);
            }
        });
        this.on('socket-error', (error) => {
            for (const e of this.handlers['socket-error']) {
                e(error);
            }
        });
    }

    connectWithRetry(initialInterval, maxInterval) {
        if (initialInterval) {
            this.initialInterval = this.interval = initialInterval;
        }
        if (maxInterval) {
            this.maxInterval = maxInterval;
        }
        this.connect(async (error, wasReconnect) => {
            if (error) {
                await Promise.all(this.handlers['connect-error'].map(e => e(error)));
                if (!this.initialInterval) {
                    return;
                }
                this.close();
                await sleep(this.interval);
                this.interval *= 2;
                this.interval = Math.min(this.interval, this.maxInterval);
                this.connectWithRetry();
            } else {
                if (this.initialInterval) {
                    this.interval = this.initialInterval;
                }
                for (const e of this.handlers['connect-success']) {
                    e(wasReconnect);
                }
            }
        });
    }

    stopRetry() {
        this.initialInterval = null;
    }

    call(name, params, callback, updatedCallback) {
        if (callback || updatedCallback) {
            super.call(name, params, callback, updatedCallback);
        } else {
            return new Promise((res, rej) => {
                this.call(name, params, function(error, result) {
                    if (error) {
                        rej(error);
                    } else {
                        res(result);
                    }
                });
            });
        }
    }

    on(event, handler) {
        this.handlers[event].push(handler);
    }
}

exports.DDPPlus = DDPPlus;
