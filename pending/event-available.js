YUI.add('eventx-available', function (Y) {

var query      = Y.Selector.query,
    isString   = Y.Lang.isString,
    hasKeys    = Y.Object.hasKeys,
    arrayIndex = Y.Array.indexOf,
    owns       = Y.Object.owns,
    pending    = {},
    config;

config = {
    type: 'available',

    // Default the poll timeout to 10 seconds
    timeout: ('pollTimeout' in Y.config) ? Y.config.pollTimeout : 10000,

    poll: function (host) {
        for (var selector in pending) {
            if (owns(pending, selector) && query(selector, null, true)) {
                host.fire(this.type, selector);
            }
        }

        if (new Date() - host._yuievt.lastRequest > this.timeout) {
            this.stopPoller(host);
        }
    },

    stopPoller: function (host) {
        var hostConfig = host._yuievt;

        if (hostConfig.pendingPoller) {
            hostConfig.pendingPoller.cancel();
            hostConfig.pendingPoller = null;
            hostConfig.lastRequest   = null;
        }
    },

    on: function (host, sub) {
        var selector = sub.thisObj,
            interval;

        if (isString(selector)) {
            // Should be in init, but contentReady shares the poller
            if (!host._yuievt._pendingPoller) {
                // default to 40ms poll
                interval = Y.config.pollInterval || 40;

                host._yuievt.pendingAvailable = pending;
                host._yuievt.POLL_INTERVAL    = interval;
                host._yuievt.pendingPoller    = Y.later(
                    interval, this, this.poll, [host], true);
            }

            if (!pending[selector]) {
                pending[selector] = [];
            }
            
            pending[selector].push(sub);

            // Renew the polling timeout reference
            host._yuievt.lastRequest = new Date();
        } else {
            return true;
        }
    },

    fire: function (host, type, selector) {
        var subs = pending[selector],
            el, i, len, sub;

        if (subs && subs.length) {
            el = query(selector, null, true);
            
            if (el) {
                // copy subscribers so detach doesn't affect iteration
                subs = subs.slice();
                for (i = 0, len = subs.length; i < len; ++i) {
                    sub = subs[i];
                    if (this.confirmReady(host, sub, el)) {
                        if (Y.Node) {
                            el = Y.one(el);
                        }

                        // pass an event object for consistency?
                        sub.callback.apply(el, sub.payload);
                        sub.detach();
                    }
                }
            }
        }
    },

    confirmReady: function (host, sub, el) {
        return true;
    },

    detach: function (host, sub) {
        var subs = pending[sub.thisObj],
            i    = arrayIndex(subs, sub);

        if (i > -1) {
            subs.splice(i, 1);

            if (!subs.length) {
                delete pending[sub.thisObj];

                if (!hasKeys(pending)) {
                    this.stopPoller(host);
                }
            }
        }
    }
};

// publish available and contentReady with same config, type overridden
Y.publish(config);
Y.publish(Y.merge(config, { // TODO: Y.Object?
    type: 'contentReady',

    confirmReady: function (host, sub, el) {
        var pass = el.nextSibling;
        while (!pass && el.parentNode && el.parentNode.nodeType === 1) {
            el   = parentNode;
            pass = el.nextSibling;
        }

        return pass;
    }
}));

}, '0.0.1', { requires: [ 'eventx-dom', 'selector-css2', 'later' ] });
