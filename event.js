YUI.add('eventx-base', function (Y) {
/**
 * Alternate event API augmentation class.
 *
 * @module eventx-core
 */

// TODO:
// - Add support for internal/locked subscriptions (can detach internally only)
var isObject   = Y.Lang.isObject,
    isArray    = Y.Lang.isArray,
    proto      = Y.Object,
    toArray    = Y.Array,
    arrayIndex = toArray.indexOf, // Y.Array.indexOf
    ArrayProto = Array.prototype,
    push       = ArrayProto.push,
    slice      = ArrayProto.slice,

    STRING     = 'string',
    BEFORE     = 'before',
    AFTER      = 'after',

    DEFAULT     = '@default',
    SUBSCRIBE   = '@subscribe',
    UNSUBSCRIBE = '@unsubscribe',
    FIRE        = '@fire',

    NULL       = function () { return null; },
    NOOP       = function () { };


/**
Class to encapsulate an event subscription. Stores the callback, execution
context (`this` in the callback), and any bound arguments to pass to the
callback after the event object.

_args_ is expected to be an array containing:
1. The event type (string)
1. The subscription callback (function)
1. Optionally the `this` object override for the callback. Defaults to _target_.
1. Optionally any additional arguments to pass to the callback

Alternately, can be used to encapsulate a set of Subscriptions by passing an
array of Subscription objects as _type_.

@class Subscription
@param {EventTarget|Subscription[]} target From whence the
                    subscription was made or an array of subscriptions
@param {Array} args See above
@param {String} phase The subscription phase
@param {Any} details Data returned from the event's `parseSignature(args)`
    method if it has one defined
**/
function Subscription(target, args, phase, details) {
    // Ew, but convenient to have new Subscription handle both single and multi
    if (!args) {
        return new BatchSubscription(target);
    }

    this.target   = target;
    this.phase    = phase;
    this.details  = details;

    this.type     = args[0];
    this.callback = args[1];
    this.thisObj  = args[2];

    if (args.length > 3) {
        this.payload = slice.call(args, 3);
    }
}

Subscription.prototype = {
    /**
    Call the subscribed callback with the provided arguments, followed by
    any bound subscription arguments.

    @method notify
    @param {Any[]} [args] Array of arguments to send to callbacks. For
                            emitFacade events, there will be only one arg: the
                            EventFacade object.
    **/
    notify: function (args) {
        var thisObj = this.thisObj || this.target,
            ret;

        if (this.payload) {
            args = args ? args.concat(this.payload) : this.payload;
        }

        ret = this.callback.apply(thisObj, args);

        // Unfortunate cost of back compat. Would rather deprecate once and
        // onceAfter in favor of e.detach(), but that would still leave
        // non-emitting events to have to detach( args or sub ). Still,
        // I think that's fine to require that!
        if (this.once) {
            this.detach();
        }

        return ret;
    },

    /**
    Detaches the subscription from the subscribed target. Convenience for
    `this.target.detach(this);`.

    @method detach
    **/
    detach: function () {
        this.target.detach(this);
    }
};

/**
Wraps an array of Subscriptions. Returned from new Y.Subscription(arrayOfSubs).

@class BatchSubscription
@constructor
@param {Subscription[]} {subs} The array of Subscriptions
**/
function BatchSubscription(subs) {
    this.subs = subs;
}
BatchSubscription.prototype = {
    /**
    Calls `detach()` on each sub in the batch.

    @method detach
    **/
    detach: function () {
        var subs = this.subs,
            i, len;

        for (i = 0, len = subs.length; i < len; ++i) {
            sub = this.subs[i];

            if (sub && sub.detach) {
                sub.detach();
            }
        }
    }
};

/**
Event object passed as the first parameter to event subscription callbacks.

Data to distinguish each instance is supplied in the _payload_ array. If the
first argument is an object (recommended), it is used to seed the event's `data`
property, which is what houses the data for the `get()` and `set()` methods.

All payload data in the passed array form is stored as the `details` property
of the event's `data` collection. While it is recommended to use `get()` to
access event data values, you can access the raw data at `e.data.details`.

@class EventFacade
@param {String} type The name of the event
@param {EventTarget} target EventTarget from which `fire()` was called
@param {Any[]} [payload] Data specific to this event, passed
**/
function EventFacade(type, target, payload) {
    var data;

    this.type = type;

    if (payload) {
        this.details = payload;

        payload = payload[0];

        if (isObject(payload, true)) {
            data = (payload instanceof EventFacade) ? payload.data : payload;
        }
    }

    this.data = data || {};
    this.data.target = target;
}

EventFacade.prototype = {
    /**
    Collection of getters to apply special logic to accessing certain data
    properties. This is a shared object on the prototype, so be careful if you
    modify it.

    @property _getter
    @type {Object}
    @protected
    **/
    _getter: {
        details: function () { return this.details; }
    },

    /**
    Collection of setters to apply special logic to assigning certain data
    properties. This is a shared object on the prototype, so be careful if you
    modify it.

    @property _setter
    @type {Object}
    @protected
    **/
    _setter: {},

    /**
    Has `e.preventDefault()` been called on this event?

    @property prevented
    @type {Boolean}
    @default `false`
    **/
    prevented: false,

    /**
    Has `e.stopPropagation()` or `e.stopImmediatePropagation()` been called on
    this event?

    Value will be one of:
    * 0 - unstopped (default)
    * 1 - `e.stopPropagation()` called
    * 2 - `e.stopImmediatePropagation()` called

    @property prevented
    @type {Number}
    @default `0`
    **/
    stopped  : 0,

    /**
    Disables any default behavior (`defaultFn`) associated with the event. This
    will also prevent any `after()` subscribers from being executed.

    @method preventDefault
    @chainable
    **/
    preventDefault: function () {
        this.prevented = true;

        return this;
    },

    /**
    Stops the event from bubbling to subsequent bubble targets. All subscribers
    on the current bubble target will be executed.

    Does not prevent the event's default behavior or its `after()` subscribers
    from being called.

    @method stopPropagation
    @chainable
    **/
    stopPropagation: function () {
        // It might have been stopped with 2 already
        if (!this.stopped) {
            this.stopped = 1;
        }

        return this;
    },

    /**
    Stops the event from bubbling to subsequent bubble targets and stops
    notification of additional subscribers on the current bubble target.

    Does not prevent the event's default behavior or its `after()` subscribers
    from being called.

    @method stopImmediatePropagation
    @chainable
    **/
    stopImmediatePropagation: function () {
        this.stopped = 2;

        return this;
    },

    /**
    Convenience function to do both `e.preventDefault()` and
    `e.stopPropagation()`. Pass a truthy value as _immediate_ to
    `e.stopImmediatePropagation()` instead.

    @method halt
    @param {Boolean} [immediate] Trigger `e.stopImmediatePropagation()`
    @chainable
    **/
    halt: function (immediate) {
        this.prevented = true;
        this.stopped = immediate ? 2 : 1;

        return this;
    },

    /**
    Detaches the subscription for this callback.

    @method detach
    @chainable
    **/
    detach: function () {
        if (this.subscription && this.subscription.detach) {
            this.subscription.detach();
        }

        return this;
    },

    /**
    Get a property from the event's data collection supplied at event creation.
    If a getter is defined for the property, its return value will be returned.
    Otherwise, the property from the data collection, if present, will be
    returned.

    @method get
    @param {String} name Data property name
    @return {Any} whatever is stored in the data property
    **/
    get: function (name) {
        if (this._getter[name]) {
            return this._getter[name].call(this, name);
        } else {
            return (name in this.data) ? this.data[name] : this[name];
        }
    },

    /**
    Set a property in the event's data collection. If a setter is defined for
    the property, it will be called with the _name_ and _val_. Otherwise, the
    property and value will be assigned to the data collection directly.

    @method set
    @param {String} name Data property name
    @param {Any} val The value to assign
    @chainable
    **/
    set: function (name, val) {
        if (this._setter[name]) {
            this._setter[name].call(this, name, val);
        } else {
            this.data[name] = val;
        }

        return this;
    }
};

if (Object.defineProperties) {
    Object.defineProperties(EventFacade.prototype, {
        target: {
            get: function () { return this.get('target'); },
            set: function (val) { this.set('target', val); }
        },
        currentTarget: {
            get: function () { return this.get('currentTarget'); },
            set: function (val) { this.set('currentTarget', val); }
        }
    });
}


/**
Collection of behaviors for subscribing to and firing a named custom event.
This class is meant to be a scaffolding for customizations. The default
method implementations support the following customizations:

* config.defaultFn(e) - Behavior executed after `on()` subscribers, before
    `after()` subscribers, and only if `e.preventDefault()` isn't called.
* config.preventable (boolean) - If `e.preventDefault()` does anything.
* config.preventedFn(e) - Called if `e.preventDefault()` is called.
* config.stoppedFn(e) - Called if `e.stopPropagation()` is called.
* config.bubbles (boolean) - Allow or disallow bubbling for this event. Default
    is `true`.
* config.allowDups (boolean) - Allow or disallow duplicate subscriptions.
    Default is `true`.
* config.on(target, subscription) - Execute this code when subscriptions are
    made to the event. Return truthy value to abort the subscription.
* config.detach(target, subscription) - Likewise when subscriptions are removed
* config.parseSignature(subArgs) - Support custom subscription signatures. Data
    returned from this function will be added to the subscription object.
* config.publish(target) - Execute this code when the event is published.
* config.Event(type, target, payload) - Class used to create the event objects
    that are passed to subscribers.
* config.Subscription(target, args, phase, details) - Class used to encapsulate
    a subscription to the event.

Additional properties and methods can be added to the event for reference from
any of the configured methods, or from overrides to the methods defined on the
CustomEvent prototype. All properties of the _config_ object are mixed onto
the event.

The primary use case for custom event creation is through static definition
on a class in the `EventTarget.configure()` call. More events can be added to
a class or specifically to a class instance using either the class's static or
instance `publish()` method.

```
Y.EventTarget.configure(MyClass, { map of events to configs }, defaultEvent);

MyClass.publish('eventX', { bubbles: false });

instance.publish('eventY', { preventable: false });
```

Events published on a class or instance derive their behavior from a default
event defined during `configure()`. The default event is a custom event whose
configured behaviors are used when `on()` or `fire()` are called for events
that aren't explicitly published for the class or instance. To create an event
that derives from a different set of event behaviors, pass the desired
prototype event as _inheritsFrom_.

@class CustomEvent
@param {String} type The name of the event
@param {Object} [config] overrides and additional properties for the event
@param {CustomEvent} [inheritsFrom=CustomEvent.prototype] prototype for this
                        event
**/
function CustomEvent(type, config, inheritsFrom) {
    var instance, key;
    
    if (!inheritsFrom && !(this instanceof CustomEvent)) {
        inheritsFrom = CustomEvent.prototype;
    }

    instance = inheritsFrom ? proto(inheritsFrom) : this;

    // Override instance properties and methods from input config
    if (config) {
        for (key in config) {
            if (config.hasOwnProperty(key)) {
                instance[key] = config[key];
            }
        }
    }

    // type can't be overridden in config
    instance.type = type;

    // Might return instance of another prototype
    return instance;
}

CustomEvent.prototype = {
    /**
    The class constructor for subscriptions to this event.  Unless the
    `subscribe` method has been overwritten with code that calls
    this constructor a different way, it will receive the following arguments:

    * `target` - the EventTarget that called `on()` or `after()`
    * `args` - the subscription arguments (type, callback, thisObj, args)
    * `phase` - 'before' or 'after'
    * `details` - returned data from `parseSignature()` if the event has it

    @property Subscription
    @type {Function}
    **/
    Subscription: Subscription,

    /**
    Coordinates the various steps involved in subscribing to this event.

    Typically defined events will not need to override this method.  The
    arguments array received as the third parameter is passed to the
    `parseSignature` method for any adjustments needed.  The methods
    called from here include:
    
    * `parseSignature(args)` if defined for this event
    * `new this.Subscription(target, args, phase, extras)` passing the
       processed argument array and any data from `parseSignature`
    * `isSubscribed(target, sub)` if `preventDups` is truthy
    * `on(target, sub)` if `on` is defined for this event
    
    The default signature of `args` is:
    * type (string)
    * callback (function)
    * thisObj (optional `this` override for callback)
    * ...argN (optional additional bound subscription args to pass to callback)
    
    @method subscribe
    @param {EventTarget} target The instance to own the subscription
    @param {Array} args Arguments listed above
    @param {String} phase The subscription phase ("before" or "after")
    @return {Subscription}
    **/
    subscribe: function (target, args, phase) {
        var details = this.parseSignature && this.parseSignature(args),
            sub     = new this.Subscription(target, args, phase, details),
            abort   = this.preventDups    && this.isSubscribed(target, sub);

        if (!abort) {
            if (this.on) {
                abort = this.on(target, sub);
            }

            // Register the subscription
            if (!abort) {
                this.registerSub(target, sub);
            } else if (abort.detach) {
                // Allow on() to return an alternate Subscription.
                // It is assumed that this subscription was registered on the
                // appropriate target.
                sub   = abort;
                abort = false;
            }
        }

        return abort ? null : sub;
    },

    /**
    Add a Subscription to the target's subs collection.

    @method registerSub
    @param {EventTarget} target The host of the event subscription
    @param {Subscription} sub The subscription to store
    **/
    registerSub: function (target, sub) {
        var subs = target._yuievt.subs;

        // target._yuievt.subs.foo
        subs = subs[sub.type] || (subs[sub.type] = {});

        // target._yuievt.subs.foo.before
        subs = subs[sub.phase] || (subs[sub.phase] = []);

        // target._yuievt.subs.foo.before.push(sub)
        subs.push(sub);
    },

    /**
    Checks to see if a duplicate subscription exists.
    
    @method isSubscribed
    @param target {Object}
    @param sub {Subscription} an instance of this.Subscription
    @return {Boolean} true (or a truthy value) to abort the subscription
    **/
    isSubscribed: function (target, sub) {
        if (target._yuievt) {
            var type     = sub.type,
                subs     = target._yuievt.subs[type],
                phase    = sub.phase,
                callback = sub.callback,
                cmp, i;

            if (subs && subs[phase]) {
                subs = subs[phase];
                for (i = subs.length - 1; i >= 0; --i) {
                    cmp = subs[i];
                    if (cmp.type     === type
                    &&  cmp.phase    === phase
                    &&  cmp.callback === callback) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    /**
    Control whether duplicate subscriptions to this event should be allowed.
    If true, the `isSubscribed` method will be called to search
    the existing subscriptions for duplicates.  If one is found, the
    subscription will be aborted.
    
    @property preventDups
    @type {Boolean}
    @default `undefined` (falsey)
    **/

    /**
    Notifies subscribers for the event.
    
    @method fire
    @param {EventTarget} target The instance from which fire was called
    @param {String} type The event type to dispatch
    @param args* {any} additional args passed `fire(type, _here_...)`
    **/
    fire: function (target, type) {
        var path = (this.bubbles && target._yuievt.bubblePath) ?
                    this.resolveBubblePath(target) : [target],
            payload, ret;

        // Only proceed if there are subscribers or it's a fireOnce event that
        // hasn't been fired
        if (this.hasSubs(path, type) || (this.fireOnce && !this._firedWith)) {
            if (arguments.length > 2) {
                payload = toArray(arguments, 2, true);
            }

            ret = this.notify(path, type, payload, BEFORE);

            if (ret !== false) {
                this.notify(path, type, payload, AFTER);
            }
        }

        if (this.fireOnce && !this._firedWith) {
            // Clear subscribers
            target._yuievt.subs[type] = null;

            // Republish the event on the instance, rerouting subscribe to
            // `immediate` unless a callback returned false, in which case, the
            // event is dead, so subscribe() and fire() are no-ops.
            target.publish(type, (ret === false) ? {
                subscribe: NULL,
                fire     : NOOP
            } : {
                subscribe : this.immediate,
                // cache the event it was initially fired with
                _firedWith: payload || []
            });
        }
    },

    /**
    Checks for subscribers along the bubble path if necessary.

    @method hasSubs
    @param {EventTarget} path The bubble path
    @param {String} type The event type to collect subscriptions for
    @return {Boolean}
    **/
    hasSubs: function (path, type) {
        for (var i = 0, len = path.length; i < len; ++i) {
            if (path[i]._yuievt.subs[type]) {
                return true;
            }
        }

        return false;
    },

    /**
    Flattens the bubble path for a given root instance.  Flattens using a
    breadth-first algorithm, so given the following bubble structure:
    ```
    . (D)  (E)   (D)  (F)
    .    \  |     |  /
    .     (B)     (C)       bubble up to
    .        \   /
    .         (A)           bubbles up to
    ```
    
    The resulting bubble path would be [A, B, C, D, E, F], and not
    [A, B, D, E, C, F] (depth-first).  Also note duplicate targets are
    ignored.  The first appearance in the bubble path wins.
    
    @method resolveBubblePath
    @param root {Object} the origin of the event to bubble (A in the diagram)
    @return {Array} the ordered list of target instances
    **/
    resolveBubblePath: function (root) {
        var targets = [root],
            known   = {},
            path    = [],
            target, yuid, i;

        // Add to the end of the targets array as we iterate.  This creates a
        // bubble path where A's immediate bubble targets are all notified, then
        // each of their respective bubble targets are notified and so on.
        // (breadth first)
        for (i = 0; i < targets.length; ++i) {
            target = targets[i];
            yuid   = target._yuievt && Y.stamp(target);

            // protect against infinite loops
            if (yuid && !known[yuid]) {
                known[yuid] = true;
                path.push(target);

                if (target._yuievt.bubblePath) {
                    // Push this target's bubble targets to the end of the
                    // targets array we're looping over.
                    push.apply(targets, target._yuievt.bubblePath);
                }
            }
        }


        return path;
    },

    /**
    This event can be subscribed to from other objects in a bubble path, added
    to with `target.addTarget(parentTarget)`

    @property bubbles
    @type {Boolean}
    @default `true`
    **/
    bubbles: true,

    /**
    Executes all the subscribers in a bubble path for an event in a given
    phase ("before" or "after").  Used by `fire()`.
    
    If a subscriber calls `e.stopImmediatePropagation()`, no
    further subscribers will be executed, and if a subscriber calls
    `e.stopPropagation()`, no further bubble targets will be
    notified.
    
    @method notify
    @param {EventTarget[]} path Bubble targets to be notified
    @param {String} type The name of the event
    @param {Any[]} payload The arguments to pass to the subscription callback
    @param {String} phase The phase of subscribers on the targets to notify
    @return {Boolean} `false` if a subscriber halted the event
    **/
    notify: function (path, type, payload, phase) {
        var i, len, subs, j, jlen, ret;

        for (i = 0, len = path.length; i < len && ret !== false; ++i) {
            subs = path[i]._yuievt.subs[type];
            subs = subs && subs[phase];

            if (subs) {
                // Snapshot subscriber list to avoid array changing during
                // notifications (e.g. once() detaches)
                subs = subs.slice();
                for (j = 0, jlen = subs.length; j < jlen; ++j) {
                    ret = subs[j].notify(payload);

                    // Erg, I hate the return false support
                    if (ret === false) {
                        // Clip bubble path. Propagation has been stopped, and
                        // on() and after() are notification phases of the same
                        // event, not separate events.
                        path.splice(i + 1);

                        return false;
                    }
                }
            }
        }
    },

    /**
    Replacement for the subscribe method on fireOnce events after they've
    fired.  Immediately executes the would-be subscription.
    
    @method immediate
    @param {EventTarget} target The instance from which on/after was called
    @param {Array} args Subscription arguments for the event (type, callback,
                        context, and extra args)
    @param {String} phase The phase of the subscription
    @return {null}
    **/
    immediate: function (target, args, phase) {
        var payload = this._firedWith,
            details = this.parseSignature && this.parseSignature(args),
            sub     = new this.Subscription(target, args, phase, details);

        sub.notify(payload);

        // TODO: Should I return the sub if it was created, even though it
        // doesn't get stored?
        return null;
    },

    /**
    Remove a subscription or set of subscriptions for this event. If the event
    has a `detach()` method defined, it will be executed and can prevent the
    subscription removal by returning a truthy value.
    
    @method unsubscribe
    @param {EventTarget} target The instance from which `detach()` was called
    @param {Array} args Arguments passed to `detach(..)`
    **/
    unsubscribe: function (target, args) {
        var sub     = args[0],
            allSubs = target._yuievt.subs,
            remove, i, len, subs, phase, abort;

        // Use case: detach(type, ...);
        if (typeof sub === STRING) {
            subs  = allSubs[sub];
            phase = args[2];

            if (!subs || (phase && !subs[phase])) {
                return;
            }

            remove   = [];
            callback = args[1];

            if (phase) {
                push.apply(remove, subs[phase]);
            } else {
                for (phase in subs) {
                    if (subs.hasOwnProperty(phase)) {
                        push.apply(remove, subs[phase]);
                    }
                }
            }

            // Not the most efficient algorithm, but avoids deep nesting. We'll
            // call it an opportunity for performance improvement (at the
            // expense of code size).
            if (args[1]) {
                callback = args[1];
                subs     = remove;
                remove   = [];

                for (i = 0, len = subs.length; i < len; ++i) {
                    if (subs[i].callback === callback) {
                        remove.push(subs[i]);
                    }
                }
            }

            // Avoids code bloat from having to test and call this.detach for
            // each discovered sub.
            sub = new BatchSubscription(remove);
        }

        if (sub instanceof BatchSubscription) {
            return sub.detach();
        }

        // use case target.detach(sub)
        // Note: this.detach not to be mistaken with sub.detach. this.detach
        // is the configuration option for the CustomEvent to do something
        // special during the detach phase of the subscription.
        if (this.detach) {
            abort = this.detach(sub);
        }

        if (!abort) {
            this.unregisterSub(target, sub);
        }
    },

    /**
    Remove a Subscription from the target's subs collection. If there are no
    remaining subscriptions in the phase or any phase of the sub's type, the
    empty objects are pruned from the target's subs collection.

    @method registerSub
    @param {EventTarget} target The host of the event subscription
    @param {Subscription} sub The subscription to remove
    **/
    unregisterSub: function (target, sub) {
        var allSubs = target._yuievt.subs,
            type    = sub.type,
            phase   = sub.phase,
            subs    = allSubs[type] && allSubs[type][phase],
            i;

        // remove the callback in case the event is currently firing,
        // since the subscriber list is copied before notifications
        // begin.
        sub.callback = NOOP;

        if (subs) {
            // Step 1. remove it from the target's _yuievt.subs collection
            for (i = subs.length - 1; i >= 0; --i) {
                if (subs[i] === sub) {
                    subs.splice(i, 1);
                    break;
                }
            }

            // Step 2. prune empty objects in _yuievt.subs
            if (!subs.length) {
                subs = allSubs[type];
                subs[phase] = null;

                cleanup = true;
                for (phase in subs) {
                    if (subs.hasOwnProperty(phase) && subs[phase]) {
                        // Still has subs in another phase
                        cleanup = false;
                        break;
                    }
                }

                if (cleanup) {
                    allSubs[type] = null;
                    // TODO: try to reset _yuievt.subs to {} if this was the
                    // last subscription to any event?
                }
            }
        }
    }
};

/**
Class to encapsulate custom event subscriptions. This is also assigned to the
`CustomEvent.prototype` for individual event overrides, but provided statically
for subclassing.

@property Subscription
@type {Function}
@static
**/
CustomEvent.Subscription = Subscription;

/**
Custom event used by `publish` and `configure` as the inherited event when an
event is configured with `emitFacade: true`. Can be used as a default event
or passed as the _inheritsFrom_ param to `publish` directly.

Notifies subscribers with an EventFacade, and supports `defaultFn` and friends.

@property FacadeEvent
@type {CustomEvent}
@static
**/
CustomEvent.FacadeEvent = new CustomEvent('@facade', {
    emitFacade: true,

    /**
    Executes subscribers for the "before" (aka "on") phase for all targets
    in the bubble chain until propagation is stopped or the last target is
    notified.  If not prevented and if the event has one, the default
    behavior is executed followed by the subscribers for the "after"
    phase up the bubble chain.
    
    If the event is prevented and it has one, the `preventedFn`
    method is executed.  "after" phase subscribers are not executed if the
    behavior is prevented.
    
    Similarly, if the event propagation is stopped and it has one, the
    `stoppedFn` method is executed.  Note, this will not prevent
    the default behavior or the "after" subscribers from being executed.
    
    @method fire
    @param {EventTarget} target The instance from which fire was called
    @param {String} type The event type to dispatch
    @param args* {any} additional args passed `fire(type, _here_...)`
    **/
    fire: function (target, type) {
        var path    = target._yuievt.bubblePath && this.bubbles ?
                        this.resolveBubblePath(target) :
                        [target],
            hasSubs = this.hasSubs(path, type),
            event, payload, args, ret;

        // Only proceed if:
        // * there are subscribers, OR
        // * it's a fireOnce event that hasn't been fired, OR
        // * it has a defaultFn, but isn't a fireOnce event that has already
        //   been fired
        if (!hasSubs && (this._firedWith || !this.defaultFn)) {
            return;
        }

        if (arguments.length > 2) {
            payload = toArray(arguments, 2, true);
        }

        event = new this.Event(type, target, payload);

        if (hasSubs) {
            // Unfortunate cost, and assumption of behavior of this.Event to
            // subsume the object in payload[0] onto the facade :(
            if (payload) {
                args = payload.slice(isObject(payload[0], true) ? 1 : 0);
                args.unshift(event);
            } else {
                args = [event];
            }

            // on() subscribers
            ret = this.notify(path, type, args, BEFORE);

            if (ret === false) {
                event.halt(true);
            }

            // default/stop/prevent behavior
            if (event.stopped && this.stoppedFn) {
                (target[this.stoppedFn] || this.stoppedFn).call(target, event);
            }

            if (event.prevented && this.preventedFn) {
                (target[this.preventedFn] || this.preventedFn)
                    .call(target, event);
            }
        }

        if (!event.prevented) {
            if (this.defaultFn) {
                (target[this.defaultFn] || this.defaultFn).call(target, event);
            }

            // after() subscribers. defaultFn can stopImmediatePropagation()
            // to abort notifying them.
            if (hasSubs && event.stopped !== 2) {
                // TODO: Reverse path? I'm going with "no" as a default.
                ret = this.notify(path, type, args, AFTER);

                if (ret === false) {
                    event.halt(true);
                }
            }
        }

        if (this.fireOnce && !this._firedWith) {
            // Clear subscribers
            target._yuievt.subs[type] = null;

            // Republish the event on the instance, rerouting subscribe to
            // `immediate` unless e.stopImmediatePropagation() was called,
            // in which case, the event is dead, so subscribe() and fire() are
            // no-ops.
            target.publish(type, (event.stopped === 2) ? {
                subscribe: NULL,
                fire     : NOOP
            } : {
                subscribe : this.immediate,
                // cache the event it was initially fired with
                _firedWith: args || []
            });
        }
    },

    /**
    Executes all the subscribers in a bubble path for an event in a given
    phase ("before" or "after").  Used by `fire()`.
    
    If a subscriber calls `e.stopImmediatePropagation()`, no further
    subscribers will be executed. Otherwise, if a subscriber calls
    `e.stopPropagation()`, no further bubble targets will be notified.
    
    @method notify
    @param {EventTarget[]} path Bubble targets to be notified
    @param {String} type The name of the event
    @param {Any[]} payload The arguments to pass to the subscription callback
    @param {String} phase The phase of subscribers on the targets to notify
    @param {Boolean} `false` if a subscriber halted the event
    **/
    notify: function (path, type, payload, phase) {
        var event   = payload[0],
            stopped = event.stopped,
            target, subs, sub, i, len, j, jlen, ret;

        event.stopped = 0;

        for (i = 0, len = path.length; i < len && ret !== false; ++i) {
            target = path[i];
            subs   = target._yuievt.subs[type]; // target might not have subs
            subs   = subs && subs[phase]; // or none for this phase

            if (subs && subs.length) {
                // Snapshot subscriber list to avoid array changing during
                // notifications (e.g. once() detaches)
                subs = subs.slice();
                event.set('currentTarget', target);

                for (j = 0, jlen = subs.length; j < jlen; ++j) {
                    sub = subs[j];
                    // facilitate e.detach();
                    event.subscription = sub;

                    ret = sub.notify(payload);

                    event.subscription = null;

                    if (ret === false) {
                        event.halt(true);
                    }

                    if (event.stopped === 2) {
                        break;
                    }
                }

                if (event.stopped) {
                    // Clip bubble path. Propagation has been stopped, and
                    // on() and after() are notification phases of the same
                    // event, not separate events.
                    path.splice(i + 1);

                    if (stopped < event.stopped) {
                        stopped = event.stopped;
                        break;
                    }
                }
            }

            event.stopped = stopped;
        }
    },

    /**
    The event facade class to use when firing an event. `fire()` generates a
    single event object that is passed to each subscriber in turn.

    Unless the `fire()` method has been overridden, This class constructor is
    called with the following arguments:

    * type (string) - The name of the event
    * target (EventTarget) - The originator of the event
    * payload (Any[]) - Array of additional args passed `fire(type, HERE...)`
    
    @property Event
    @type {Function}
    **/
    Event: EventFacade,

    /**
    Can this event's `defaultFn` be avoided by calling `e.preventDefault()`?

    @property preventable
    @type {Boolean}
    @default `true`
    **/
    preventable: true,

    /**
    Replacement for the subscribe method on fireOnce events after they've
    fired.  Immediately executes the would-be subscription.
    
    @method immediate
    @param {EventTarget} target The instance from which on/after was called
    @param {Array} args Subscription arguments for the event (type, callback,
                        context, and extra args)
    @param {String} phase The phase of the subscription
    @return {null}
    **/
    immediate: function (target, args, phase) {
        var payload = this._firedWith,
            event   = payload[0],
            details, sub;

        if (event.stopped < 2 && (phase !== AFTER || !event.prevented)) {
            details = this.parseSignature && this.parseSignature(args);
            sub     = new this.Subscription(target, args, phase, details);

            event.set('currentTarget', target);

            sub.notify(payload);

            event.set('currentTarget', null);
        }

        // TODO: Should I return the sub if it was created, even though it
        // doesn't get stored?
        return null;
    }
});

/**
Class used to handle routing EventTarget APIs to smart events. Instances of
this class are inserted into the class or instance's event map if the
class/instance has any smart events published on it.

@class CustomEvent.Router
**/
CustomEvent.Router = function () {
    this.events = [];
};

CustomEvent.Router.prototype = {
    /**
    Adds a smart event to the array of events to test against when routing.

    @method registerEvent
    @param {CustomEvent} event The event to add
    **/
    registerEvent: function (event) {
        if (arrayIndex(this.events, event) === -1) {
            if (event.pattern && !event.test) {
                event.test = this.patternTest;
            }

            if (event.test) {
                this.events.push(event);
            }
        }
    },

    /**
    Runs the method signature against the registered events' `test` method and
    Returns the first registered event that returns `true` from its `test`
    method. Otherwise, returns the target's default event.

    @method getEvent
    @param {EventTarget} target The hosting EventTarget
    @param {Any} args Any additional arguments passed to `subscribe`,
                        `unsubscribe` or `fire`
    **/
    getEvent: function (target) {
        var i, len, event;

        for (i = 0, len = this.events.length; i < len; ++i) {
            event = this.events[i];

            if (event.test.apply(event, arguments)) {
                return event;
            }
        }

        return target.getEvent(DEFAULT);
    },

    /**
    Tests the _type_ argument of whatever calling method against the event's
    configured `pattern` property.

    This method assumes the `pattern` property exists, is a regex, and that the
    first item in the _args_ parameter is the _type_.

    @method patternTest
    @param {EventTarget} target (ignored)
    @param {Any[]} args Array of arguments passed to the calling method
    @return {Boolean} true if the _type_ matches the event's `pattern`
    **/
    patternTest: function (target, args) {
        return this.pattern.test(args[0]);
    },

    /**
    Pass through that gets a matching smart event or the target's default event
    and relays the calling arguments to its `subscribe` method.

    @method subscribe
    @param {EventTarget} target The instance to own the subscription
    @param {Array} args Arguments passed to the target's `on()`, `after()`, or
                            `subscribe` method
    @param {String} phase The subscription phase ("before" or "after")
    @return {Subscription}
    **/
    subscribe: function () {
        var event = this.getEvent.apply(this, arguments);

        return event && event.subscribe.apply(event, arguments);
    },

    /**
    Pass through that gets a matching smart event or the target's default event
    and relays the calling arguments to its `unsubscribe` method.

    @param {EventTarget} target The instance from which `detach()` was called
    @param {Array} args Arguments passed to `detach(..)`
    **/
    unsubscribe: function () {
        var event = this.getEvent.apply(this, arguments);

        return event && event.unsubscribe.apply(event, arguments);
    },

    /**
    Pass through that gets a matching smart event or the target's default event
    and relays the calling arguments to its `fire` method.

    @param {EventTarget} target The instance from which fire was called
    @param {String} type The event type to dispatch
    @param args* {any} additional args passed `fire(type, _here_...)`
    **/
    fire: function () {
        var event = this.getEvent.apply(this, arguments);

        return event && event.fire.apply(event, arguments);
    }
};



/**
Augmentation class or superclass to add event related API methods.

@class EventTarget
@constructor
**/
function EventTarget(defaults) {
    this._yuievt = {
        subs  : {},
        events: proto(this.constructor.events || Y.EventTarget.events)
    };

    if (defaults) {
        this.publish(DEFAULT, defaults);
    }
}

Y.mix(EventTarget, {
    /**
    Configures a class as an EventTarget, adding the static `publish()` method,
    constructing its default event, and publishing any specific class events.

    It is necessary to call this method before any instances of a class are
    created. It is advisable to `configure` a class when the class is defined.

    Supply a _defaultEvent_ as a CustomEvent instance or as an object of
    property and method overrides. Overrides will be applied to either an
    instance of the superclass's default event if the class is an EventTarget,
    or to a stock instance of CustomEvent. The _defaultEvent_ will be used as
    the prototype for all published events on the class or its instances. If
    omitted, an instance derived from the superclass's default event will be
    used, falling back to a stock CustomEvent.

    It is still necessary for EventTarget subclass constructors to call the
    EventTarget constructor. This method only sets up the class level events and
    publish mechanism.

    @method configure
    @param {Object|Function} Class The class or object instance to enable
                                events for
    @param {Object} [events] Class events to publish
    @param {Object|CustomEvent} [defaultEvent] Event to handle unknown events
                                    and establish base behavior for all class
                                    events
    @static
    **/
    configure: function (Class, events, defaultEvent) {
        var superEvents = Class.superclass &&
                          Class.superclass.constructor.events,
            superEvent;

        // Add the static publish method to the class
        Class.publish = function (type, config, inheritsFrom, smart) {
            // bind to the class for portability
            return Y.EventTarget._publish(Class, Class.events,
                        type, config, inheritsFrom, smart);
        };

        if (!Class.events) {
            Class.events = {};
        }

        // Create the class's @default event if necessary
        if (Class.events[DEFAULT]) {
            if (defaultEvent) {
                Class.publish(DEFAULT, defaultEvent);
            }
        } else {
            if (!defaultEvent || !(defaultEvent instanceof CustomEvent)) {
                if (superEvents) {
                    superEvent = superEvents[DEFAULT];
                }

                // Weak point. Disregarding superclass default event if
                // configured with emitFacade. If the superclass default event
                // is also configured with emitFacade, it's assumed to be a
                // FacadeEvent.
                if (defaultEvent && defaultEvent.emitFacade &&
                        (!superEvent || !superEvent.emitFacade)) {
                    superEvent = CustomEvent.FacadeEvent;
                }

                defaultEvent =
                    new CustomEvent(DEFAULT, defaultEvent, superEvent);
            }

            Class.events[DEFAULT] = defaultEvent;
        }

        if (events) {
            Class.publish(events);
        }
    },

    /**
    Publishes an event for all instances of a class.

    This method is added to EventTarget subclasses by
    `EventTarget.configure(MyClass,...)`.

    Define specific behavioral overrides from the class's default event in the
    _config_ object. If the event doesn't have special behavior, it is not
    necessary to publish it.

    If an event should behave like an event other than the default event, pass
    that CustomEvent object as _inheritsFrom_. _config_ overrides will be
    applied over the inherited event's behaviors. If no overrides are
    necessary, just pass the CustomEvent as _config_ and omit _inheritsFrom_.

    If an event should be registered as a smart event rather than published as
    a standalone event, include the _smart_ parameter. Pass an array of the
    lifecycle phases that you want the event listening for. Available phases:

    * "subscribe"
    * "unsubscribe"
    * "fire"
    * "delegate" (if eventx-delegate is also loaded)

    Smart events must have a method `test(target, argsArray, method)` that
    should return true if control should be routed to that event's appropriate
    method. E.g. this event will route subscriptions for 'itemClick#some-id'
    to the 'itemClick' event with a filtering callback that will only call the
    subscribed callback if the clicked item's id matches the id from the
    subscription. It will not intercept `fire` or `unsubscribe`.

    ```
    // Handle subscriptions like menu.on('itemClick#upload', callback)
    Y.Menu.publish('@itemClick', {
        test: function (target, args, method) {
            return (method === 'subscribe' && !args[0].indexOf('itemClick#'));
        },

        subscribe: function (target, args, phase) {
            var itemId   = args[0].slice(args[0].indexOf('#') + 1),
                callback = args[1],
                sub;

            args[0] = 'itemClick';
            args[1] = this.filter;

            sub     = target.subscribe.apply(target, args);
            sub.details.itemId   = itemId;
            sub.details.callback = callback;

            return sub;
        },

        filter: function (e) {
            var sub = e.subscription;

            if (e.get('currentTarget').id === sub.details.itemId) {
                return sub.details.callback.apply(this, arguments);
            }
        }
    }, null, ['subscribe']);
    ```

    Pass an object map of event names to configuration objects to publish
    multiple events at once.

    @method publish
    @param {String|Object} type The name of the event to publish or a map of
                                configs
    @param {Object} [config] Behavioral extensions and overrides for this event
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            default event
    @param {String[]} [smart] smart events register the event with
    @static
    **/

    /**
    Does the work for class and instance `publish()` methods.

    @method _publish
    @param {Function|EventTarget} target Class or instance to publish on
    @param {Object} events Map of events on the class or instance
    @param {String|Object} type The name of the event to publish or a map of
                                configs
    @param {Object} [config] Behavioral extensions and overrides for this event
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            default event
    @param {String[]} [smart] smart events register the event with
    @static
    @protected
    **/
    _publish: function (target, events, type, config, inheritsFrom, smart) {
        var CustomEvent = Y.CustomEvent,
            event, i, name;

        if (isObject(type)) {
            for (event in type) {
                if (type.hasOwnProperty(event)) {
                    EventTarget._publish(target, events, event,
                        type[event], inheritsFrom, smart);
                }
            }
        } else {
            event = events[type];

            if (typeof inheritsFrom === STRING) {
                inheritsFrom = events[inheritsFrom];
            }

            if (config && config instanceof CustomEvent) {
                event = config;
            } else if (events.hasOwnProperty(type)) {
                // promoting a non-facade event to emit facade has to create a
                // new event based off FacadeEvent. This is a bit of a hack
                // because the event being replaced only has its own-properties
                // mixed onto the FacadeEvent instance, but it might be 2+
                // supers away. Unlikely, but possible.
                if (config && config.emitFacade && !event.emitFacade) {
                    event =
                        new CustomEvent(type, event, CustomEvent.FacadeEvent);
                }

                if (config) {
                    Y.mix(event, config, true);
                }
            } else { // Create a new event
                if (!inheritsFrom) {
                    // event is the first default to handle the use case of
                    // publishing an instance version of an existing class event
                    inheritsFrom = event || events[DEFAULT];
                }

                // non-facade event promoted to facade event. This is not a
                // common use case, but the reverse condition is ugly. See
                // above lengthy comment about how this is also a hack.
                if (config && config.emitFacade && !inheritsFrom.emitFacade) {
                    event = Y.mix(
                        new CustomEvent(type,
                            inheritsFrom, CustomEvent.FacadeEvent),
                        config, true);
                } else {
                    event = new CustomEvent(type, config, inheritsFrom);
                }
            }

            if (event.publish) {
                event.publish(target);
            }

            if (smart && isArray(smart)) {
                for (i = smart.length - 1; i >= 0; --i) {
                    name = '@' + smart[i];

                    if (!events[name]) {
                        events[name] = new Y.CustomEvent.Router();
                    }

                    events[name].registerEvent(event);
                }
            } else {
                events[type] = event;
            }

        }
    }
}, true);

EventTarget.prototype = {
    /**
    Add a new event to this instance's collection of events.  Use
    this to add an event with specific default behavior, preventedFn
    behavior, or special subscription/detach logic (etc).  If the event
    doesn't behave in any way different from the default event, you don't have
    to publish it.  If the event applies to all instances, publish it
    statically for the class instead.
    
    Accepts an event configuration object with properties and methods to
    override those defined in the class's default event. Optionally, a
    different event can be used for defaults by passing it as _inheritsFrom_.
    
    Pass the type string as the first parameter and the configuration as the
    second. Alternately, pass an object map of type => configs.
    
    If an event should be registered as a smart event rather than published as
    a standalone event, include the _smart_ parameter. Pass an array of the
    lifecycle phases that you want the event listening for. Available phases:

    * "subscribe"
    * "unsubscribe"
    * "fire"

    @method publish
    @param {String|Object} type Name of the event or map of types to configs
    @param {Object} [config] Event configuration overrides from the defaults
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            default event
    @param {String[]} [smart] smart events register the event with
    @chainable
    **/
    publish: function (type, config, inheritsFrom, smart) {
        EventTarget._publish(this, this._yuievt.events,
            type, config, inheritsFrom, smart);

        return this;
    },

    /**
    Get the event by name. If the named event is not found, the default event
    is returned unless a truthy value is passed for _publishedOnly_.

    @method getEvent
    @param {String} type The event name
    @param {Boolean} [publishedOnly] return `null` instead of the default event
    @return {CustomEvent}
    **/
    getEvent: function (type, publishedOnly) {
        var events = this._yuievt.events;

        return events[type] || (!publishedOnly && events[DEFAULT]);
    },

    /**
    Subscribe to an event on this object.  Subscribers in this "before"
    phase will have access to prevent any default event behaviors (if the
    event permits prevention).
    
    _type_ may be a string identifying the event, an array of event names,  or
    an object map of types to callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.on(type, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type string
    exactly, smart events will be tested if any have been published for this
    class or instance. If either no smart events have been published or none
    match the subscription signature, the default event behavior will be used.
    
    @method on
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    on: function (type) {
        var events = this._yuievt.events,
            event  = events[type],
            args;

        if (!event) {
            if (typeof type === STRING) {
                event = events[SUBSCRIBE] || events[DEFAULT];
            } else {
                // Defer object/array syntax handling and smart event
                // resolution to subscribe()
                args = toArray(arguments, 0, true);
                args.splice(1, 0, BEFORE);

                return this.subscribe.apply(this, args);
            }
        }

        return event.subscribe(this, arguments, BEFORE);
    },

    /**
    Subscribe to an event on this object.  Subscribers in this "after"
    phase will not have access to prevent any default behaviors (if the event
    permits prevention), but will also not be executed unless the default
    behavior executes.
    
    _type_ may be a string identifying the event, an array of event names,  or
    an object map of types to callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.after(type, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type string
    exactly, smart events will be tested if any have been published for this
    class or instance. If either no smart events have been published or none
    match the subscription signature, the default event behavior will be used.
    
    @method after
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    after: function (type) {
        var events = this._yuievt.events,
            event  = events[type],
            args;

        if (!event) {
            if (typeof type === STRING) {
                event = events[SUBSCRIBE] || events[DEFAULT];
            } else {
                // Defer object/array syntax handling and smart event
                // resolution to subscribe()
                args = toArray(arguments, 0, true);
                args.splice(1, 0, AFTER);

                return this.subscribe.apply(this, args);
            }
        }

        return event.subscribe(this, arguments, AFTER);
    },

    /**
    Subscribe to an event on this object.  This method is a catchall
    for events that might support more than the standard "before" (aka
    "on") and "after" phases.  This method allows for subscription to
    any event phase.
    
    _type_ may be a string identifying the event, an array of event names,  or
    an object map of types to callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.subscribe(type, phase, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type string
    exactly, smart events will be tested if any have been published for this
    class or instance. If either no smart events have been published or none
    match the subscription signature, the default event behavior will be used.
    
    @method subscribe
    @param {String} type {String} event type to subcribe to
    @param {String} phase {String} event phase to attach subscription
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    subscribe: function (type, phase) {
        var events = this._yuievt.events,
            event  = events[type],
            args   = toArray(arguments, 0, true),
            i, len, subs;

        if (!event) {
            if (typeof type === STRING) {
                event = events[SUBSCRIBE] || events[DEFAULT];
            } else if (isObject(type)) {
                subs = [];
                if (isArray(type)) {
                    for (i = 0, len = type.length; i < len; ++i) {
                        args[0] = type[i];
                        subs.push(this.subscribe.apply(this, args));
                    }
                } else {
                    for (event in type) {
                        if (type.hasOwnProperty(event)) {
                            args[0] = event;
                            // Weak point, assumes signature includes callback
                            // as third arg for the event (sorta).
                            args[2] = type[event];
                            subs.push(this.subscribe.apply(this, args));
                        }
                    }
                }

                // Batch Subscription
                return new BatchSubscription(subs);
            }
        }

        // Remove phase from args array. It's passed separately
        args.splice(1, 1);

        return event.subscribe(this, args, phase);
    },

    /**
    Subscribe to the next firing of a specified event on this object.
    Subscribers in this "before" phase will have access to prevent any default
    event behaviors (if the event permits prevention).
    
    Behaves as `on()`, but automatically detaches the subscription after the
    callback has been notified.
    
    For facade emitting events, it is recommended to use `e.detach()` in the
    callback rather than `once()`.

    @method once
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see note in `on()` for default signature
    @return {Subscription}
    **/
    once: function () {
        var sub = this.on.apply(this, arguments),
            i;

        if (sub) {
            if (sub.subs) {
                for (i = sub.subs.length - 1; i >= 0; --i) {
                    if (sub.subs[i]) {
                        sub.subs[i].once = true;
                    }
                }
            } else {
                sub.once = true;
            }
        }

        return sub;
    },

    /**
    Subscribe to the next firing of the specified event on this object.
    Subscribers in this "after" phase will not have access to prevent any
    default behaviors, and will not be executed if the default behavior was
    prevented by an `on()` subscriber.
    
    Behaves as `after()`, but automatically detaches the subscription after the
    callback has been notified.
    
    For facade emitting events, it is recommended to use `e.detach()` in the
    callback rather than `onceAfter()`.

    @method onceAfter
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see note in `after()` for default signature
    @return {Subscription}
    **/
    onceAfter: function () {
        var sub = this.after.apply(this, arguments);

        if (sub) {
            if (sub.subs) {
                for (i = sub.subs.length - 1; i >= 0; --i) {
                    if (sub.subs[i]) {
                        sub.subs[i].once = true;
                    }
                }
            } else {
                sub.once = true;
            }
        }

        return sub;
    },

    /**
    Trigger the execution of subscribers to a specific event. The default
    notification order for events is:

    1. `on()` subscribers on this object, in the order they were subscribed
    2. `on()` subscribers up the bubble path
    3. `defaultFn` for the event if configured
    4. `after()` subscribers on this object, in subscription order
    5. `after()` subscribers up the bubble path
    
    Events can be configured with alternate notification logic, though this
    is rare.

    Subscribers will be called with a first parameter `e`, which is an
    EventFacade seeded with the data passed to `fire()`. See that class
    definition for details. Note, events can also be reconfigured to use
    an alternate EventFacade class, though again this is rare.
    
    @method fire
    @param {String} type The type of event whose subscribers to notify
    @param args* {any} extra arguments to pass along
    @chainable
    **/
    fire: function (type) {
        var events = this._yuievt.events,
            event  = events[type] || events[FIRE] || events[DEFAULT];
            args  = toArray(arguments, 0, true);

        args.unshift(this);

        event.fire.apply(event, args);

        return this;
    },

    /**
    Unsubscribe one or multiple subscribers.  Some example signatures are:

    <table>
        <thead>
            <tr><th>Called with</th><th>What is detached</th></tr>
        </thead>
        <tbody>
            <tr>
                <td>`detach()`</td>
                <td>All subscriptions to all events in all phases</td>
            </tr>
            <tr>
                <td>`detach(subscriptionObject)`</td>
                <td>That subscription</td>
            </tr>
            <tr>
                <td>`detach("foo")`</td>
                <td>All subscriptions to event "foo" in all phases</td>
            </tr>
            <tr>
                <td>`detach("foo", "before")`</td>
                <td>All subscriptions to event "foo" in the "before"
                    phases</td>
            </tr>
            <tr>
                <td>`detach("foo", "before", callbackFunc)*`</td>
                <td>All subscriptions to event "foo" in the "before"
                    phase that are bound to callbackFunc  (*See below for
                    notes)</td>
            </tr>
        </tbody>
    </table>
    
    Note, parameters beyond the type are passed to the event's `detach`
    method to apply any signature specific filtration for the subscriber
    list, so the detach signature that passes the callback is just an
    example of the signature supported by the default event.
    
    @method detach
    @param type {String} (optional) event subscription object
                         or event type string, optionally with category
    @param phase {String} (optional) phase from which to detach
    @param args* {any} additional arguments used by the event's
                         `detach` method to better
                         isolate which sub(s) to detach.
    @return {Object} this instance
    @chainable
    **/
    detach: function (type) {
        var events = this._yuievt.events,
            event;

        if (type) {
            // type.detach indicates detach(sub), but we can't call
            // type.detahc() here because the implementation of
            // Subscription.detach is this.target.detach(this); which would
            // cause infinite recursion.
            event = (type.detach ? events[type.type] : events[type]) ||
                    events[UNSUBSCRIBE] || events[DEFAULT];

            event.unsubscribe(this, arguments);
        } else {
            this.detachAll();
        }

        return this;
    },

    /**
    Detaches all event subscriptions on the instance.

    @method detachAll
    @chainable
    **/
    detachAll: function () {
        var subs   = this._yuievt.subs,
            detach = [],
            event, phase, i;

        // Flatten the list of subs first because sub.detach() will modify the
        // lists.
        for (event in subs) {
            if (subs.hasOwnProperty(event)) {
                for (phase in subs[event]) {
                    if (subs[event].hasOwnProperty(phase)) {
                        push.apply(detach, subs[event][phase]);
                    }
                }
            }
        }

        for (i = detach.length - 1; i >= 0; --i) {
            detach[i].detach && detach[i].detach();
        }

        // Final clean up
        this._yuievt.subs = {};

        return this;
    },

    /**
    Add a bubble target, allowing subscriptions from the bubble target for
    events emitted by this object.
    
    @method addTarget
    @param target {Object} instance of an object augmented with Event.API
    @return {Object} this instance
    @chainable
    **/
    addTarget: function (target) {
        var path = this._yuievt.bubblePath;

        if (!path) {
            this._yuievt.bubblePath = [target];
        } else if (arrayIndex(path, target) === -1) {
            path.push(target);
        }

        return this;
    }
};

EventTarget.configure(EventTarget);

Y.Subscription      = Subscription;
Y.BatchSubscription = BatchSubscription;

Y.CustomEvent = CustomEvent;
Y.EventFacade = EventFacade;
Y.EventTarget = EventTarget;

/**
@for YUI
@uses EventTarget
**/
// Add the EventTarget API to Y
Y.mix(Y, Y.EventTarget.prototype, true);
Y.EventTarget.call(Y);

/**
Global EventTarget that can be used to communicate between YUI instances (using
events, presumably).

@property Global
@type {EventTarget}
**/
Y.Global = YUI.Env.globalEvents || (YUI.Env.globalEvents = new EventTarget());

}, '', { requires: ['oop'] });
