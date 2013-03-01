YUI.add('eventx-delegate', function (Y) {
/**
Adds `delegate` method to EventTarget.prototype and a base implementation to
the CustomEvent.prototype. Event's can override their `delegate` and/or
`delegateNotify` method to provide a custom implementation.

@module eventx
@submodule eventx-delegate
@for EventTarget
**/
var toArray = Y.Array,
    CEproto = Y.CustomEvent.prototype;

/**
Make a delegated event subscription. The default signature for delegation is:

```
target.delegate(type, callback, filterFn, thisOverride, ...args);
```

However, published events can override this signature to look for the filter in
a different argument position or accept filters in different forms (such as
selector strings for DOM subscriptions).

_type_ can be a single event name string, an array of event name strings, or an
object map of event names to callbacks.

@method delegate
@param {String|String[]|Object} type
@param {Any} args* See above for default signature
@return {Subscription}
**/
Y.EventTarget.prototype.delegate = function (type) {
    var events = this._yuievt.events,
        event  = events[type],
        args   = toArray(arguments, 0, true),
        i, len, subs;

    if (!event) {
        if (typeof type === 'string') {
            event = events['@delegate'] || events['@default'];
        } else if (isObject(type)) {
            subs = [];
            if (isArray(type)) {
                for (i = 0, len = type.length; i < len; ++i) {
                    args[0] = type[i];
                    subs.push(this.delegate.apply(this, args));
                }
            } else {
                for (event in type) {
                    if (type.hasOwnProperty(event)) {
                        args[0] = event;
                        // Weak point, assumes signature includes callback
                        // as second arg for the event (sorta).
                        args[1] = type[event];
                        subs.push(this.delegate.apply(this, args));
                    }
                }
            }

            // Batch Subscription
            return new Y.CustomEvent.Subscription(subs);
        }
    }

    return event.delegate ? event.delegate(this, args) : null;
};

/**
@for CustomEvent
**/
CEproto.delegate = function (target, args) {
    var subs     = target._yuievt.subs,
        type     = args[0],
        callback = args[1],
        filter   = args[2],
        sub      = null;

    if (callback && filter) {
        // Remove the filter replace the callback with the delegation callback
        args.splice(1, 2, this.delegateNotify);

        sub = new this.Subscription(target, args, 'before', {
            callback : callback,
            filter   : filter,
            container: target
        }),

        subs = subs[type] || (subs[type] = {});
        subs = subs['before'] || (subs['before'] = []);
        subs.push(sub);
    }

    return sub;
};

CEproto.delegateNotify = function (e) {
    var sub     = e.subscription,
        details = sub && sub.details,
        filter  = details && details.filter,
        container, target, defaultThisObj, event, path, i, len;

    if (filter) {
        container   = details.container;
        defaultThis = (container === this);
        target      = e.get('target');
        path        = target.getEvent(e.type).resolveBubblePath(target);

        e.set('container', container);

        for (i = 0, len = path.length; i < len; ++i) {
            e.set('currentTarget', path[i]);

            if (filter.call(sub, e)) {
                // arguments contains e, which has had its currentTarget
                // updated.
                details.callback
                    .apply((defaultThis ? path[i] : this), arguments);
            }

            // e.stopPropagation() behaves as though the event were bubbling.
            // Break out of the loop if the subscribed target isn't the last
            // in the bubble path.
            if (e._stopped || path[i] === container) {
                break;
            }
        }
    }
};


// Add Y.delegate, since the prototype was mixed on, not inherited
Y.delegate = Y.EventTarget.prototype.delegate;

}, '', { requires: ['eventx'] });
