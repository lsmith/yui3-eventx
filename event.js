YUI.add('eventx', function (Y) {
/**
 * Alternate event API augmentation class.
 *
 * @module eventx-core
 */

// TODO:
// - Implement broadcast?
// - Add support for internal/locked subscriptions (can detach internally only)
var isObject   = Y.Lang.isObject,
    isArray    = Y.Lang.isArray,
    proto      = Y.Object,
    toArray    = Y.Array,
    arrayIndex = toArray.indexOf, // Y.Array.indexOf
    values     = proto.values,    // Y.Object.values
    push       = Array.prototype.push,
    slice      = Array.prototype.slice,

    STRING     = 'string',
    BEFORE     = 'before',
    AFTER      = 'after',
    BASE       = '@BASE',
    DEFAULT    = '@DEFAULT';


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

    /**
    Prototype for this object, before any overrides. Use this to call methods
    overridden methods from your custom overrides rather than reimplementing
    the overridden logic.

    ```
    target.publish('foo', {
        subscribe: function () {
            console.log('Subscribing to foo');
            return this._super.subscribe.apply(this, arguments);
        }
    });
    ```

    This is a public property despite the leading underscore. 'super' is a
    reserved word, and requiring this['super'] is silly.

    @property _super
    @type {CustomEvent}
    @default `Y.CustomEvent.prototype`
    **/
    instance._super = inheritsFrom || CustomEvent.prototype;

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

/**
Class to encapsulate custom event subscriptions. This is also assigned to the
`CustomEvent.prototype` for individual event overrides, but provided statically
for subclassing.

@property Subscription
@type {Function}
@static
**/
CustomEvent.Subscription = Subscription;

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
    @param {String} phase The subscription phase ("before" or "after")
    @param {Array} args Arguments listed above
    @return {Subscription}
    **/
    subscribe: function (target, phase, args) {
        var details = this.parseSignature && this.parseSignature(args),
            sub     = new this.Subscription(target, args, phase, details),
            abort   = this.preventDups    && this.isSubscribed(target, sub),
            subs;

        if (!abort) {
            if (this.on) {
                abort = this.on(target, sub);
            }

            // Register the subscription
            if (!abort) {
                // This was inlined from previous iteration as
                // registerSub(target, sub), which then called abstracted
                // function pushByPath(target._yuievt, ...) to avoid the extra
                // function hops. It might be useful to break this back out to
                // registerSub(), but for now, start simple.
                subs = target._yuievt.subs;

                // target._yuievt.subs.foo
                subs = subs[sub.type] || (subs[sub.type] = {});

                // target._yuievt.subs.foo.before
                subs = subs[sub.phase] || (subs[sub.phase] = []);

                // target._yuievt.subs.foo.before.push(sub)
                subs.push(sub);
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
            event, payload;

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
            // on() subscribers
            this.notify(path, event, BEFORE);

            // default/stop/prevent behavior
            if (event._stopped && this.stoppedFn) {
                this.stoppedFn.call(target, event);
            }

            if (event._prevented this.preventedFn) {
                this.preventedFn.call(target, event);
            }
        }

        if (this.defaultFn && !event._prevented) {
            this.defaultFn.call(target, event);
        }

        // after() subscribers. defaultFn can stopImmediatePropagation()
        // to abort notifying them.
        if (hasSubs && event._stopped !== 2) {
            // TODO: Reverse path? I'm going with "no" as a default.
            this.notify(path, event, AFTER);
        }

        if (this.fireOnce && !this._firedWith) {
            // Clear subscribers
            target._yuievt.subs[type] = null;

            // Republish the event on the instance, rerouting subscribe to
            // `immediate`
            target.publish(type, {
                subscribe : this.immediate,
                // cache the event it was initially fired with
                _firedWith: event
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
        // TODO: This returns a false positive if all subscribers have been
        // detached because detach() only splices from the phase array. I'm
        // guessing this is an edge case and not worth the code overhead to
        // handle for now. I'm sure that's a fanciful thought, and I will be
        // proven wrong.
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
            path    = {},
            target, yuid;

        // Add to the end of the path as we iterate.  This creates a bubble
        // path where A's immediate bubble targets are all notified, then
        // each of their respective bubble targets are notified and so on.
        // (breadth first)
        for (i = 0; i < targets.length; ++i) {
            target = targets[i];
            yuid   = target._yuievt && Y.stamp(target);

            // protect against infinite loops
            if (yuid && !path[yuid]) {
                path[yuid] = target;

                if (target._yuievt.bubblePath) {
                    push.apply(targets, target._yuievt.bubblePath);
                }
            }
        };

        // Less than ideal that this relies on insertion order, which isn't
        // required by spec. But to date, only V8 returns keys out of order,
        // and that's specifically when they are numeric. yuid stamps
        // are strings. This would be a horrifying bug to track down, but it
        // simplifies the logic and seems pragmatic given the current
        // commitment of JS engine authors not to break the web.
        return values(path);
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
    Executes all the subscribers in a bubble path for an event in a given
    phase ("before" or "after").  Used by `fire()`.
    
    If a subscriber calls `e.stopImmediatePropagation()`, no
    further subscribers will be executed, and if a subscriber calls
    `e.stopPropagation()`, no further bubble targets will be
    notified.
    
    @method notify
    @param {EventTarget[]} path Bubble targets to be notified
    @param {EventFacade} event The event object to pass to the subscribers
    @param {String} phase The phase to identify which subscribers to notify
    **/
    notify: function (path, event, phase) {
        var type = event.type,
            target, subs, sub, i, len, j, jlen;

        for (i = 0, len = path.length; i < len; ++i) {
            target = path[i];
            subs   = target._yuievt.subs[type]; // target might not have subs
            subs   = subs && subs[phase]; // or none for this phase

            if (subs && subs.length) {
                event.data.currentTarget = target;

                for (j = 0, jlen = subs.length; j < jlen; ++j) {
                    sub = subs[j];
                    // facilitate e.detach();
                    event.subscription = sub;

                    sub.notify(event);

                    event.subscription = null;

                    if (event._stopped > 1) {
                        break;
                    }
                }

                if (event._stopped) {
                    break;
                }
            }
        }
    },

    /**
    Can this event's `defaultFn` be avoided by calling `e.preventDefault()`?

    @property preventable
    @type {Boolean}
    @default `true`
    **/
    preventable: true,

    /**
    Replacement for the subscribe method on fireOnce events after they've
    fired.  Immediately executes the would be subscription.
    
    @method immediate
    @param {EventTarget} target The instance from which on/after was called
    @param {String} phase The phase of the subscription
    @param {Array} args Subscription arguments for the event (type, callback,
                        context, and extra args)
    @return {boolean} false (prevents formal subscription)
    **/
    immediate: function (target, phase, args) {
        var event = this._firedWith;

        if (event._stopped < 2 && (phase !== AFTER || !event._prevented)) {
            // Note: parseSignature and new Subscription are not done because
            // no subscription is being added, so e.detach() should be a no-op.
            event.data.currentTarget = target;
            sub.notify(event);
        }

        // No subscription is created
        return null;
    },

    /**
    Remove a subscription or set of subscriptions for this event. If the event
    has a `detach()` method defined, it will be executed and can prevent the
    subscription removal by returning a truthy value.
    
    @method unsubscribe
    @param {EventTarget} target The instance from which on/after was called
    @param {Array} args Arguments passed to `detach(..)`
    **/
    unsubscribe: function (target, args) {
        var type = args[0],
            subs = target._yuievt.subs,
            i, phase, abort;

        // Custom detach() can return truthy value to abort the unsubscribe
        if (this.detach && this.detach.apply(this, args)) {
            return;
        }

        if (type.type && type.callback && type.phase) {
            // Use case: detach(sub);
            subs = subs[type.type][type.phase];
            for (i = subs.length - 1; i >= 0; --i) {
                if (subs[i] === type) {
                    subs.splice(i, 1);
                    break;
                }
            }
        } else if (subs[type]) {
            subs     = subs[type];
            callback = args[1];
            phase    = args[2];

            if (phase) {
                if (callback) {
                    // Use case: detach(type, callback, phase)
                    subs = subs[phase];
                    for (i = subs.length - 1; i >= 0; --i) {
                        if (subs[i].callback === callback) {
                            subs.splice(i, 1);
                            break;
                        }
                    }
                } else {
                    // Use case: detach(type, null, phase)
                    subs[phase] = [];
                }
            } else {
                // Use case: detach(type, callback) or detach(type)
                this.unsubscribe(target, [type, callback, BEFORE]);
                this.unsubscribe(target, [type, callback, AFTER]);
            }
        }
    }
};

/**
Class to encapsulate an event subscription. Stores the callback, execution
context (`this` in the callback), and any bound arguments to pass to the
callback after the event object.

_args_ is expected to be an array containing:
1. The event type (string)
1. The subscription callback (function)
1. Optionally the `this` object override for the callback. Defaults to _target_.
1. Optionally any additional arguments to pass to the callback

@class Subscription
@param {EventTarget} target From whence the subscription was made
@param {Array} args See above
@param {String} phase The subscription phase
@param {Any} details Data returned from the event's `parseSignature(args)`
    method if it has one defined
**/
function Subscription(target, args, phase, details) {
    // Ew, but convenient to have Subscription support wrapping a batch of
    // subscriptions
    if (args) {
        this.target   = target;
        this.phase    = phase;
        this.details  = details;

        this.type     = args[0];
        this.callback = args[1];
        this.thisObj  = args[2];

        if (args.length > 3) {
            this.payload = slice.call(args, 3);
        }
    } else if (isArray(target)) {
        this.subs = target;
    }
}

Subscription.prototype = {

    /**
    Call the subscribed callback with the provided event object, followed by
    any bound subscription arguments.

    @method notify
    @param {EventFacade} e The event object to pass as first arg to the callback
    **/
    notify: function (e) {
        var thisObj = this.thisObj || this.target,
            args;

        // Avoid extra work if the subscription didn't bind additional callback
        // args.
        if (this.payload) {
            args = [e];
            push.apply(args, this.payload);

            this.callback.apply(thisObj, args);
        } else {
            this.callback.call(thisObj, e);
        }
    },

    /**
    Detaches the subscription from the subscribed target. Convenience for
    `this.target.detach(this);`.

    @method detach
    **/
    detach: function () {
        var sub, i, len;

        if (this.subs) {
            for (i = 0, len = this.subs.length; i < len; ++i) {
                sub = this.subs[i];

                if (sub && sub.detach) {
                    sub.detach();
                }
            }
        } else {
            this.target.detach(this);
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
    this.type    = type,
    this.data    = (payload && isObject(payload[0])) ? payload[0] : {};

    this.data.target  = target;
    this.data.details = payload;
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
    _getter: {},

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

    @property _prevented
    @type {Boolean}
    @default `false`
    **/
    _prevented: false,

    /**
    Has `e.stopPropagation()` or `e.stopImmediatePropagation()` been called on
    this event?

    Value will be one of:
    * 0 - unstopped (default)
    * 1 - `e.stopPropagation()` called
    * 2 - `e.stopImmediatePropagation()` called

    @property _prevented
    @type {Number}
    @default `0`
    **/
    _stopped  : 0,

    /**
    Disables any default behavior (`defaultFn`) associated with the event. This
    will also prevent any `after()` subscribers from being executed.

    @method preventDefault
    @chainable
    **/
    preventDefault: function () {
        this._prevented = true;

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
        if (!this._stopped) {
            this._stopped = 1;
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
        this._stopped = 2;

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
        this._prevented = true;
        this._stopped = immediate ? 2 : 1;

        return this;
    },

    /**
    Detaches the subscription for this callback.

    @method detach
    @chainable
    **/
    detach: function () {
        if (this.subscription) {
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
            return this._getter[name](name);
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
            this._setter[name](name, val);
        } else {
            this.data[name] = val;
        }

        return this;
    }
};


/**
Augmentation class or superclass to add event related API methods.

@class EventTarget
@constructor
**/
function EventTarget() {
    var events = this.constructor.events;

    this._yuievt = {
        subs  : {},
        events: events ? proto(events) : {}
    };
}

Y.mix(EventTarget, {
    /**
    Configures a class as an EventTarget, adding the static `publish()` method,
    constructing its default event, and publishing any specific class events.

    It is necessary to call this method before any instances of a class are
    created. It is advisable to `configure` a class when the class is defined.

    Supply a _baseEvent_ as a CustomEvent instance or as an object of property
    and method overrides. Overrides will be applied to either an instance of the
    superclass's base event if the class is an EventTarget, or to a stock
    instance of CustomEvent. The _baseEvent_ will be used as the prototype for
    all published events on the class or its instances. If omitted, an instance
    derived from the superclass's base event will be used, falling back to a
    stock CustomEvent.

    Supply a _defaultEvent_ as a CustomEvent instance or as an object of
    property and method overrides. Overrides will be applied to either an
    instance of the superclass's default event if the class is an EventTarget,
    or to an event derived from the _baseEvent_. If omitted, an instance
    derived from the superclass's default event will be used, falling back to
    an event derived from the base event.

    It is still necessary for EventTarget subclass constructors to call the
    EventTarget constructor. This method only sets up the class level events and
    publish mechanism.

    @method configure
    @param {Object|Function} Class The class or object instance to enable
                                events for
    @param {Object} [events] Class events to publish
    @param {Object|CustomEvent} [baseEvent] Event to establish base behavior for
                                    all published class events
    @param {Object|CustomEvent} [defaultEvent] Event to handle unknown events
                                    and establish base behavior for all class
                                    events
    @static
    **/
    configure: function (Class, events, baseEvent, defaultEvent) {
        var superEvents = Class.superclass &&
                          Class.superclass.constructor.events,
            isInstance  = typeof Class !== 'function',
            superEvent;

        if (!isInstance) {
            // Add the static publish method to the class
            Class.publish = function () {
                // bind to the class for portability
                return EventTarget.publish.apply(Class, arguments);
            }
        }

        // Create the class's @BASE event if necessary
        if (!(baseEvent instanceof CustomEvent)) {
            if (superEvents) {
                superEvent = superEvents[BASE];
            }

            baseEvent = new CustomEvent(BASE, baseEvent, superEvent);
        }

        // Create the class's @DEFAULT event if necessary
        if (!(defaultEvent instanceof CustomEvent)) {
            if (superEvents) {
                superEvent = superEvents[DEFAULT];
            }

            defaultEvent = new CustomEvent(DEFAULT,
                defaultEvent, superEvent || baseEvent);
        }

        (isInstance ? Class._yuievt : Class).events = {
            '@BASE'   : baseEvent,
            '@DEFAULT': defaultEvent
        };

        if (events) {
            Class.publish(events);
        }
    },

    /**
    Publishes an event for all instances of a class.

    This method is added to EventTarget subclasses by
    `EventTarget.configure(MyClass,...)`.

    Define specific behavioral overrides from the class's base event in the
    _config_ object. If the event doesn't have special behavior, it is not
    necessary to publish it.

    If an event should behave like an event other than the base event, pass that
    CustomEvent object as _inheritsFrom_. _config_ overrides will be applied
    over the inherited event's behaviors.

    Pass an object map of event names to configuration objects to publish
    multiple events at once.

    @method publish
    @param {String|Object} type The name of the event to publish or a map of
                                configs
    @param {Object} [config] Behavioral extensions and overrides for this event
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            default event
    @static
    **/
    publish: function (type, config, inheritsFrom) {
        EventTarget._publish(this, this.events, type, config, inheritsFrom);
    },

    /**
    Does the work for class and instance `publish()` methods.

    @method _publish
    @param {Function|EventTarget} target Class or instance to publish on
    @param {Object} events Map of events on the class or instance
    @param {String|Object} type The name of the event to publish or a map of
                                configs
    @param {Object} [config] Behavioral extensions and overrides for this event
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            base event
    @static
    @protected
    **/
    _publish: function (target, events, type, config, inheritsFrom) {
        var event;

        if (isObject(type)) {
            for (event in type) {
                if (type.hasOwnProperty(event)) {
                    EventTarget._publish(target, events, event,
                        type[event], inheritsFrom);
                }
            }
        } else {
            event = events[type];

            if (config instanceof CustomEvent) {
                event = config;
            } else if (!event || inheritsFrom) {
                event = new CustomEvent(type, config,
                                inheritsFrom || events[BASE]);
            } else if (event) {
                Y.mix(event, config);
            }

            if (event.publish) {
                event.publish(target);
            }

            events[type] = event;
        }
    }

}, true);

EventTarget.prototype = {
    /**
    Add a new event to this instance's collection of events.  Use
    this to add an event with specific default behavior, preventedFn
    behavior, or special subscription/detach logic (etc).  If the event
    doesn't behave in any way different from the base event, you don't have
    to publish it.  If the event applies to all instances, publish it
    statically for the class instead.
    
    Accepts an event configuration object with properties and methods to
    override those defined in the class's base event. Optionally, a
    different base event can be used by passing it as _inheritsFrom_.
    
    Pass the type string as the first parameter and the configuration as the
    second. Alternately, pass an object map of type => configs.
    
    @method publish
    @param {String|Object} type Name of the event or map of types to configs
    @param {Object} config Event configuration overrides from the defaults
    @chainable
    **/
    publish: function (type, config, inheritsFrom) {
        EventTarget._publish(this, this._yuievt.events,
            type, config, inheritsFrom);

        return this;
    },

    /**
    Get the event by name. If the named or default event would route the named
    event to another event, that logic is not performed.

    To exclude the default event, pass a truthy value to _publishedOnly_.

    @method getEvent
    @param {String} type The event name
    @param {Boolean} [publishedOnly] Don't return the default event
    @return {CustomEvent}
    **/
    getEvent: function (type, publishedOnly) {
        var event = this._yuievt.events[type];

        return event || (!publishedOnly && this._yuievt.events[DEFAULT]);
    },

    /**
    Subscribe to an event on this object.  Subscribers in this "before"
    phase will have access to prevent any default event behaviors (if the
    event permits prevention).
    
    _type_ may be a string identifying the event or an object map of types to
    callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.on(type, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type
    string exactly, the default event behavior will be used.
    
    @method on
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    on: function (type) {
        var event = this._yuievt.events[type],
            args  = arguments;

        if (!event) {
            if (typeof type === STRING) {
                event = this._yuievt.events[DEFAULT];
            } else {
                args = toArray(args, 0, true);
                args.splice(1, 0, BEFORE);
                // Defer object/array syntax handling to subscribe()
                return this.subscribe.apply(this, args);
            }
        }

        return event.subscribe(this, BEFORE, args);
    },

    /**
    Subscribe to an event on this object.  Subscribers in this "after"
    phase will not have access to prevent any default behaviors (if the event
    permits prevention), but will also not be executed unless the default
    behavior executes.
    
    _type_ may be a string identifying the event or an object map of types to
    callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.after(type, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type
    string exactly, the default event behavior will be used.
    
    @method after
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    after: function (type) {
        var event = this._yuievt.events[type],
            args  = arguments;

        if (!event) {
            if (typeof type === STRING) {
                event = this._yuievt.events[DEFAULT];
            } else {
                args = toArray(args, 0, true);
                args.splice(1, 0, AFTER);
                // Defer object/array syntax handling to subscribe()
                return this.subscribe.apply(this, args);
            }
        }

        return event.subscribe(this, AFTER, args);
    },

    /**
    Subscribe to an event on this object.  This method is a catchall
    for events that might support more than the standard "before" (aka
    "on") and "after" phases.  This method allows for subscription to
    any event phase.
    
    _type_ may be a string identifying the event or an object map of types to
    callback functions.

    Custom events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    target.subscribe(type, phase, callback, thisObj, extraArg, ...exrtraArgN);
    ```

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is `target`, the object from which `on()` was
    called. Arguments beyond _thisObj_ will be passed to the callback after the
    event object generated by `fire()`.
    
    If no event published for this class or instance matches the type
    string exactly, the default event behavior will be used.
    
    @method subscribe
    @param {String} type {String} event type to subcribe to
    @param {String} phase {String} event phase to attach subscription
    @param {Any*} sigArgs see above note on default signature
    @return {Subscription}
    **/
    subscribe: function (type, phase) {
        var event = this._yuievt.events[type],
            args  = toArray(arguments, 0, true),
            i, len, subs;

        if (!event) {
            if (typeof type === STRING) {
                event = this._yuievt.events[DEFAULT];
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
                return new Y.CustomEvent.Subscription(subs);
            }
        }

        // Remove phase from args array. It's passed separately
        args.splice(1, 1);

        return event.subscribe(this, phase, args);
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
        var event = this._yuievt.events[type] ||
                    this._yuievt.events[DEFAULT],
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
            // detach batch subscription
            if (type.detach && !type.type) {
                type.detach();
            } else {
                // type.type to support detach(sub)
                event = events[type.type] || events[type] || events[DEFAULT];
                event.unsubscribe(this, arguments);
            }
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

Y.CustomEvent = CustomEvent;
Y.EventFacade = EventFacade;
Y.EventTarget = EventTarget;

}, '', { requires: ['oop'] });
