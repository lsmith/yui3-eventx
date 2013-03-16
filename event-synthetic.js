YUI.add('eventx-synthetic', function (Y) {
/**
Backward compatibility shim for Y.Event.define.

@module eventx
@submodule eventx-synthetic
@for Y.Event
**/
Y.Event.SyntheticEvent = new Y.CustomEvent({
    subscribe: function (target, args, phase, delegate) {
        var details, sub, filter, el, node, eventKey, subs, i, len;

        args = toArray(args, 0, true);

        // processArgs rather than parseSignature for back compat
        details = this.processArgs && this.processArgs(args, filter);

        if (target === Y) {
            target = args.splice(2,1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el && (el.nodeType || el === Y.config.win)) {
            if (delegate) {
                filter = args.splice(2, 1)[0];
            }

            eventKey = args[0] = Y.stamp(el) + ':' + type;

            if (!details) {
                details = {};
            }
            details.domType = type;

            sub = new this.Subscription(Y, args, 'before', details);

            if (this.on) {
                // notifier and subscription are the same object
                // filter is passed to allow on() to handle individual and
                // delegate subscriptions
                this.on(node, sub, sub, filter);
            }

            this.registerSub(Y, sub);
        } else if (el && el.length) {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                // args[0] is assigned the eventKey. Need to reset it.
                args[0] = type;
                subs.push(this.subscribe(el[i], args, phase, filter));
            }

            // Return batch subscription
            sub = new Y.CustomEvent.Subscription(subs);
        }

        return sub;
    },

    detach: function (target, args) {
        // TODO: call into this._oldDetach(node, sub, sub)
    },

    delegate: function (target, args) {
        return this.subscribe(target, args, 'before', true);
    }
});

Y.Event.define = function (type, config, force) {
    config = Y.merge(config);

    if (config.detach) {
        config._oldDetach = config.detach;
        // Don't override the SyntheticEvent's detach
        delete config.detach;
    }

    Y.Event.DOM_EVENTS[type] =
        new Y.CustomEvent(type, config, Y.Event.SyntheticEvent);
};

}, '', { requires: ['node-base'] });
