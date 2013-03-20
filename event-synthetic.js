YUI.add('eventx-synthetic', function (Y) {
/**
Backward compatibility shim for Y.Event.define.

@module eventx
@submodule eventx-synthetic
@for Y.Event
**/
var toArray = Y.Array,
    nodeMap = Y.Node._instances,
    DOMEvent = Y.Event.DOMEvent,
    NOOP = function () {};

function SynthSubscription() {
    Y.Event.DOMEvent.Subscription.apply(this, arguments);
}

Y.extend(SynthSubscription, DOMEvent.Subscription, {
    notify: function (args) {
        var e       = args && args[0],
            thisObj = this.thisObj ||
                      (e && e.get && e.get('currentTarget')) ||
                      nodeMap[this.details.nodeYuid]; // default to container?

        if (e && e.type) {
            e.type = this.details.domType;
        }

        if (this.payload) {
            args = toArray(args);
            args.push.apply(args, this.payload);
        }

        // Unfortunate cost of back compat. Would rather deprecate once
        // and onceAfter in favor of e.detach().
        if (this.once) {
            this.detach();
        }

        return this.callback.apply(thisObj, args);
    },

    // To mock the notifier object from current synth infrastructure
    fire: function () {
        this.notify(arguments);
    }
});

Y.Event.SyntheticEvent = new Y.CustomEvent({
    subscribe: function (target, args, phase, delegate) {
        var method = (delegate && this._oldDelegate) ? '_oldDelegate' : 'on',
            type   = args[0],
            details, sub, filter, el, node, eventKey, subs, i, len;

        args = toArray(args, 0, true);

        // processArgs rather than parseSignature for back compat
        details = this.processArgs && this.processArgs(args, delegate);

        if (target === Y) {
            target = args.splice(2,1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el && (el.nodeType || el === Y.config.win)) {
            node = Y.one(el);

            if (delegate) {
                filter = args.splice(2, 1)[0];
            }

            eventKey = args[0] = Y.stamp(el) + ':' + type;

            if (!details) {
                details = {};
            }

            details.domType  = type;
            details.nodeYuid = node._yuid;

            sub = new this.Subscription(Y, args, 'on', details);

            if (this.preventDups && this.isSubscribed(Y, sub)) {
                return null;
            }

            // either this.on or this._oldDelegate. Not this.delegate because
            // the method is inherited from CE.proto when eventx-delegate is
            // use()d, and this.hasOwnProperty('delegate') doesn't support
            // prototypal inheritance for synthetics.
            if (this[method]) {
                // notifier and subscription are the same object
                // filter is passed to allow on() to handle individual and
                // delegate subscriptions
                this[method](node, sub, sub, filter);
            }

            this.registerSub(Y, sub);
        } else if (el && el.length) {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                // args[0] is assigned the eventKey. Need to reset it.
                args[0] = type;
                subs.push(this.subscribe(el[i], args, phase, delegate));
            }

            // Return batch subscription
            sub = new Y.BatchSubscription(subs);
        }

        return sub;
    },

    detach: function (target, sub) {
        var node;

        if (this._oldDetach) {
            // TODO: better default? I'd rather not store the Node instance
            node = nodeMap[sub.details.nodeYuid] || Y;

            this._oldDetach(node, sub, sub);
        }
    },

    delegate: function (target, args) {
        return this.subscribe(target, args, 'before', true);
    },

    Subscription: SynthSubscription,

    _addDOMSub: NOOP,
    _removeDOMSub: NOOP
}, DOMEvent);

Y.Event.define = function (type, config, force) {
    if (force || !Y.Event.DOM_EVENTS[type]) {
        config = Y.merge(config);

        if (config.detach) {
            config._oldDetach = config.detach;
            // Don't override the SyntheticEvent's detach
            delete config.detach;
        }

        if (config.delegate) {
            config._oldDelegate = config.delegate;
            delete config.delegate;
        }

        Y.Event.DOM_EVENTS[type] =
            new Y.CustomEvent(config, Y.Event.SyntheticEvent);
    }
};

}, '', { requires: ['node-base'] });
