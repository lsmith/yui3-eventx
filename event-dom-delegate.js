YUI.add('eventx-dom-delegate', function (Y) {
/**
Adds DOM event delegation support to Y.Event.

@module eventx
@submodule eventx-dom-delegate
**/
var toArray = Y.Array;

Y.Event.publish('@DEFAULT', {
    // It's a shame that I had to duplicate so much logic from subscribe()
    delegate: function (target, args) {
        var type       = args[0],
            sub        = null,
            isDOMEvent = Y.Node ?
                            Y.Node.DOM_EVENTS[type] :
                            Y.Event.isEventSupported(type),
            event = !isDOMEvent &&
                        this.getSmartEvent(target, args, 'delegate'),
            isYEvent, i, len, type, el, subs, eventKey, needsDOMSub,
            callback, filter, selector;

        if (event) {
            return event.delegate ? event.delegate(target, args) : null;
        }
        
        if (!isDOMEvent) {
            // Custom event subscription
            return this._super.delegate.call(this, target, args);
        }

        // DOM event subscription
        // Convert from arguments object to array
        isYEvent = (target === Y.Event);
        args = toArray(args, 0, true);
        el = Y.Event._resolveTarget(isYEvent ? args[2] : target);

        if (el && el.nodeType) {
            callback = args[1];
            filter   = args[isYEvent ? 3 : 2];

            if (typeof filter === 'string') {
                selector = filter;
                filter   = this.selectorFilter
            }

            // Remove the target and filter from args to allow thisObj and
            // payload args to slide into their proper indices. Replace the
            // callback with delegation callback.
            args.splice(1, (isYEvent ? 3 : 2), this.delegateNotify);

            eventKey = args[0] = Y.stamp(el) + ':' + type;

            sub = new this.Subscription(Y.Event, args, 'on', {
                callback : callback,
                filter   : filter,
                container: el,
                selector : selector
            });

            this.registerSub(Y.Event, sub);

            // First subscription needs a DOM subscription
            if (Y.Event._yuievt.subs[eventKey].on.length === 1) {
                YUI.Env.add(el, type, Y.Event._handleEvent, false);
            }
        // TODO: el could be a DOM collection ala getElementsByTagName()
        } else if (isArray(el)) {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                if (isYEvent) {
                    args[2] = el[i];
                } else {
                    target = el[i];
                }

                subs.push(this.delegate(target, args));
            }

            // Return batch subscription
            sub = new Y.CustomEvent.Subscription(subs);
        }

        return sub;
    },

    delegateNotify: function (e) {
        var sub     = e.subscription,
            details = sub && sub.details,
            filter  = details && details.filter,
            container, target, currentTarget, defaultThisObj, i, len;

        if (filter) {
            // TODO: I'm here. This needs to be replaced with a parentAxis walk
            // akin to current delegate implementation
            container   = details.container;
            defaultThis = (container === this);
            target      = e._event.target || e._event.srcElement;

            e.set('container', container);

            while (target.nodeType === 3) {
                target = target.parentNode;
            }

            while (target) {
                e.set('currentTarget', target);

                if (filter.call(sub, e)) {
                    currentTarget = defaultThis ? e.get('currentTarget') : this;
                    // arguments contains e, which has had its currentTarget
                    // updated.
                    details.callback.apply(currentTarget, arguments);
                }

                if (e._stopped || target === container) {
                    break;
                }

                target = target.parentNode;
            }
        }
    },

    selectorFilter: function (e) {
        var currentTarget = e.get('currentTarget'),
            container     = e.get('container'),
            root          = currentTarget === container ? null : container;

        return Y.Selector.test(currentTarget, this.details.selector, root);
    }
});

}, '', { requires: [ 'eventx-dom', 'eventx-delegate' ] });
