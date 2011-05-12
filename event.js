/**
 * Alternate event API augmentation class.
 *
 * @module eventx-core
 */
YUI.add('eventx-core', function (Y) {

// TODO:
// - Extract the bubbleTo and bubbling support to a submodule?
// - Implement appliesTo? Submodule?
// - Implement queuable.
// - Implement broadcast? (_evt level for all events?)
// - Add support for internal/locked subscriptions (can detach internally only)
var YObject    = Y.Object,
    YArray     = Y.Array,
    YLang      = Y.Lang,
    each       = YArray.each,
    isObject   = YLang.isObject,
    isString   = YLang.isString,
    proto      = YObject,
    toArray    = YArray,
    arrayIndex = YArray.indexOf,
    owns       = YObject.owns;


/**
 * Assigns a property:value to an object at an arbitrary depth indicated in the
 * <code>path</code> parameter.  If any point on the path doesn't exist, it is
 * created.
 *
 * E.g. <code>var x = {}; setByPath(x, ['foo','bar'], 1)</code>
 * would result in <code>x</code> structured like
 * <code>{ foo: { bar: 1 } }</code>
 *
 * @method setByPath
 * @param o {Object} object root of the path
 * @param path {Array} property names identifying the nesting location
 * @param subject {any} the item to push to the array
 * @private
 */
function setByPath(o, path, val) {
    for (var i = 0, len = path.length - 1; i < len; ++i) {
        o = o[path[i]] || (o[path[i]] = {});
    }

    o[i] = val;
}

/**
 * Pushes an object onto an array located at the path identified by following
 * the property name strings in the <code>path</code> parameter.  If any
 * point on the path doesn't exist, it is created.  The last point in the path
 * should be an array.
 *
 * E.g. <code>var x = {}; pushToPath(x, ['foo','bar'], 1)</code>
 * would result in <code>x</code> structured like
 * <code>{ foo: { bar: [ 1 ] } }</code>
 *
 * @method pushToPath
 * @param o {Object} object root of the path
 * @param path {Array} property names identifying the nesting location
 * @param subject {any} the item to push to the array
 * @private
 */
function pushByPath(o, path, subject) {
    for (var i = 0, len = path.length - 1; i < len; ++i) {
        o = o[path[i]] || (o[path[i]] = {});
    }

    (o[path[i]] || (o[path[i]] = [])).push(subject);
}

/**
 * Augmentation class to add event related API methods to instances of the host
 * class.  Extend the class by any of the following methods:
 * <ul>
 *   <li><code>Y.augment(MyClass, Y.Event.Target, true);</code></li>
 *   <li><code>Y.extend(MyClass, Y.Event.Target, ...);</code></li>
 *   <li><code>function MyClass() { Y.Event.Target.apply(this, arguments); }
 *       Y.mix(MyClass, Y.Event.Target, true, null, 1);</code></li>
 * </ul>
 *
 * @class Y.Event.Target
 * @constructor
 * @param config {Object} (optional) configuration object for this instance
 *                          (see <code>_initEvents</code> for details)
 */
function EventTarget() {
    this._initEvents.apply(this, arguments);
}

/* FIXME:
 * I don't like the manual step to build the event defs AND augmenting a class
 * with Y.Event.Target.  Maybe Y.Event.Target.augment(classToAugment)? Some
 * single step would be ideal.
 */

/**
 * <p>Default lifecycle methods for any unknown event being referenced by the
 * API. This is the generic custom event behavior.</p>
 *
 * <p>To define specific events (only needed if they require special behavior),
 * you can describe them statically on the class in the <code>EVENTS</code>
 * property.  Event behaviors will extend the <code>defaultEvent</code>
 * specified in the <code>EVENTS</code> collection, falling back to the default
 * generic custom event behavior.  Populate the <code>EVENTS</code> collection
 * by capturing the return value of
 * <code>Y.Event.configure({ (all event defs) })</code>, like this:</p>
 * <pre><code>
 * . MyClass.EVENTS = Y.Event.configure({
 * .    foo: {
 * .        // All other behaviors inherited from the defaultEvent
 * .        setup: function (host, subscription, callback) { ... }
 * .        teardown: function (host, subscription, callback) { ... }
 * .    }
 * . });
 * . Y.augment(MyClass, Y.Event.Target);</code></pre>
 *
 * <p>If defining new default behaviors for a class, the default event
 * definition will need to implement the following methods:</p>
 * <ul>
 *     <li><code>subscribe(host, subscription_kernel, args*)</code></li>
 *     <li><code>unsubscribe(host, subscription, args*)</code></li>
 *     <li><code>fire(host, type, *)</code></li>
 * </ul>
 *
 * <p>Supply the defaultEvent in the class's EVENTS collection just as you
 * would any other custom event.  You can cheat by extending the default custom
 * event prototype.</p>
 * <pre><code>
 * . MyClass.EVENTS = Y.Event.configure({
 * .    defaultEvent: new Y.CustomEvent({
 * .        subscribe: function (host, sub) { ... },
 * .        unsubscribe: function (host, sub) { ... },
 * .        fire: function (host, type) { ... }
 * .    }),
 * .    foo: {
 * .        // All other behaviors inherited from the defaultEvent
 * .        setup: function (host, subscription, callback) { ... }
 * .        teardown: function (host, subscription, callback) { ... }
 * .    }
 * . });
 * . Y.augment(MyClass, Y.Event.Target);</code></pre>
 *
 * <p>Return false from <code>subscribe</code> or <code>unsubscribe</code> to
 * prevent the subscription or detach respectively.</p>
 *
 * <p>The default implementation of these methods also supports the following
 * properties/methods:</p>
 * <ul>
 *     <li><code>setup(host, subscription_kernel, args*)</code></li>
 *     <li><code>on(host, subscription_kernel, args*)</code></li>
 *     <li><code>detach(host, subscription_kernel, args*)</code></li>
 *     <li><code>teardown(host, type)</code></li>
 *     <li><code>preventDups</code> (true|false) property</li>
 *     <li><code>getSubs(host, type, category, phase)</code></li>
 *     <li><code>registerSub(host, sub)</code></li>
 *     <li><code>unregisterSub(host, sub)</code></li>
 *     <li><code>test(type, args*)</code></li>
 * </ul>
 *
 * <p>Each method is called passing the event definition as 'this', and the
 * host instance as the first arg.  You
 * can include any more or methods or properties on an event definition, but
 * the definition object should not manage state (e.g. fireOnce should not
 * update a property on the event definition) unless that state applies to
 * all instances and derived event definitions.</p>
 *
 * <p>See the descriptions for the individual eventDef methods and
 * properties.</p>
 * 
 * @class CustomEvent
 * @type {Object}
 * @static
 */
function CustomEvent(config) {
    for (var k in config) {
        if (config.hasOwnProperty(k)) {
            this[k] = config[k];
        }
    }
}

CustomEvent.prototype = {
    /**
     * The class constructor for subscriptions to this event.  Unless the
     * <code>subscribe</code> method has been overwritten with code that calls
     * this constructor a different way, it will receive as arguments the array
     * of arguments passed to <code>subscribe</code> and any data returned from
     * the event's <code>processArgs</code> method (if defined).  E.g.
     * <code> var sub = new this.Subscription(argArray, data);</code>
     *
     * @property Subscription
     * @type {Function}
     * @protected
     */
    Subscription: Subscription,

    /**
     * <p>Test the provided event type string and other args passed to
     * <code>on(type, ...)</code> or <code>after(type, ...)</code> to indicate
     * that this event definition should handle the subscription.  By default,
     * event mapping is a direct type string => event definition.  This allows
     * for more generic type strings that can be used to trigger specific
     * behavior in the <code>init</code> or <code>subscribe</code> methods.
     * An example would be a regex based test that matched
     * <code>on("key(shift+enter)", ...)</code>.</p>
     *
     * <p>Return true to indicate that this event should handle the
     * subscription.</p>
     *
     * <p>This is optional for any event, but can also be included in a default
     * event.  By default, a simple type => event mapping is used.</p>
     *
     * @method test
     * @param host {Object} the instance from which on/after was called
     * @param type {String} the type string passed to <code>on(..)</code> or
     *                      <code>after(..)</code>
     * @param args* {any} additional arguments after type and phase (e.g.
     *                      callback function)
     * @return {boolean} true to indicate that this event should handle the
     *                      subscription
     * @protected
     */

    /**
     * Coordinates the various steps involved in subscribing to this event.
     * <p>Typically defined events will not need to override this method.  The
     * arguments array received as the parameter is passed to the
     * <code>processArgs</code> method for any adjustments needed.  The methods
     * called from here include:</p>
     *
     * <ul>
     *     <li><code>processArgs</code> if defined for this event</li>
     *     <li><code>new this.Subscription</code> passing the processed
     *          argument array and any data from <code>processArgs</code></li>
     *     <li><code>initialize</code> if defined for this event</li>
     *     <li><code>isSubscribed</code> if preventDups is truthy</li>
     *     <li><code>on</code> if defined for this event</li>
     *     <li><code>registerSub</code> unless any above step returns true to
     *          abort the subscription</li>
     * </ul>
     *
     * <p>These methods (unless overwritten) expect the following arguments:</p>
     * <ul>
     *     <li>host (the event host)</li>
     *     <li>type (this event type)</li>
     * FIXME: Get rid of category
     *     <li>category</li>
     *     <li>phase (e.g. "before")</li>
     *     <li>callback</li>
     * </ul>
     *
     * @method subscribe
     * @param args {Array} arguments listed above
     * @return {boolean} true to abort subscription, otherwise proceed
     * @static
     * @protected
     */
    subscribe: function (args) {
        var details = this.processArgs && this.processArgs(args),
            sub     = new this.Subscription(args, details),
            abort;

        args.splice(1, 0, sub);

        abort = this.init && this.initialize(args);

        if (!abort && !this.preventDups) {
            abort = this.isSubscribed.apply(this, args);
        }

        if (!abort) {
            if (this.on) {
                abort = this.on.apply(this, args);
            }

            if (!abort) {
                this.registerSub.apply(this, args);
            }
        }
    },

    /**
     * Calls the event's <code>init</code> method if defined and records that
     * the event was initialized unless <code>init</code> returns true to abort
     * the subscription.
     *
     * @method initialize
     * @param args {Array} The subscription args with Subscription inserted
     * @return {Boolean} false to proceed with the subscription, true (or a
     *              truthy value) to abort the subscription
     * @protected
     */
    initialize: function (args) {
        var host = args[0],
            type = args[1].type,
            evt = host._yuievt,
            abort;

        if (!evt || !evt.init || !owns(evt.init, type)) {
            abort = this.init.apply(this, arguments);
            if (!abort) {
                setByPath(host, ['_yuievt', 'init', type], true);
            }
        }

        return abort;
    },

    /**
     * Checks to see if a duplicate subscription exists.
     *
     * @method isSubscribed
     * @param host {Object}
     * @param sub {Subscription} an instance of this.Subscription
     * @return {Boolean} true (or a truthy value) to abort the subscription
     * @protected
     */
    isSubscribed: function (host, sub) {
        if (host._yuievt) {
            var subs  = host._yuievt.subs[sub.type],
                type  = sub.type,
                phase = sub.phase,
                cmp, i;

            if (subs && subs[phase]) {
                subs = subs[phase];
                for (i = subs.length - 1; i >= 0; --i) {
                    cmp = subs[i];
                    if (cmp.type     === type &&
                        cmp.phase    === phase &&
                        cmp.callback === sub.callback) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    /**
     * <p>Initial one-time setup for an event.  E.g. for a group of events
     * that each relate to a shared set of DOM events, the init for each would
     * set up those DOM event subscribers if not already subscribed.
     * Also see <code>destroy</code>.</p>
     *
     * <p>Return true to abort the subscription (for example when routing a
     * subscription to another system or event).  To allow the subscription
     * to proceed, return false or simply omit an explicit return statement.</p>
     *
     * @method init
     * @param host {Object} the instance from which on/after was called
     * @param sub {Object} the initial subscription object
     * @param args* {Any} additional arguments passed to subscribe, including
     *              the callback, thisObj, and additional arguments
     * @return {boolean} true to abort the subscription, otherwise proceed
     * @protected
     */

    /**
     * Adds a subscription to the host's internal store of subscriptions.
     *
     * @method registerSub
     * @param host {Object} the event host that will manage the subscription
     * @param sub {Object} subscription object
     * @static
     */
    registerSub: function (host, sub) {
        pushByPath(host,['_yuievt','subs', sub.type, sub.phase], sub);

        /*
        if (sub.category) {
            pushByPath(host._yuievt.cats,
                [sub.category, sub.type, sub.phase], sub);
        }
        */
    },

    /**
     * Removes a subscription to the host's internal store of subscriptions.
     *
     * @method unregisterSub
     * @param host {Object} the event host that manages subscriptions
     * @param sub {Object} subscription object
     * @static
     */
    unregisterSub: function (host, sub) {
        var subs = YObject.getValue(host, ['_yuievt', 'subs', sub.type, sub.phase]),
            i;

        // TODO: this is inefficient
        if (subs) {
            i = arrayIndex(subs, sub);
            if (i > -1) {
                subs.splice(i, 1);

                /*
                if (sub.category) {
                    subs = YObject.getValue(host._yuievt.cats[sub.category],
                            [sub.type, sub.phase]);

                    if (subs) {
                        i = arrayIndex(subs, sub);
                        if (i > -1) {
                            subs.splice(i, 1);
                        }
                    }
                }
                */
            }
        }
    },

    /**
     * Control whether duplicate subscriptions to this event should be allowed.
     * If true, the <code>isSubscribed</code> method will be called to search
     * the existing subscriptions for duplicates.  If one is found, the
     * subscription will be aborted before reaching the <code>on</code> method.
     *
     * @property preventDups
     * @type {boolean}
     * @static
     * @protected
     */

    /**
     * <p>Executes subscribers for the "before" (aka "on") phase for all targets
     * in the bubble chain until propagation is stopped or the last target is
     * notified.  If not prevented and if the event has one, the default
     * behavior is executed followed by the subscribers for the "after"
     * phase up the bubble chain.</p>
     *
     * <p>If the event is prevented and it has one, the <code>preventedFn</code>
     * method is executed.  "after" phase subscribers are not executed if the
     * behavior is prevented.</p>
     *
     * <p>Similarly, if the event propagation is stopped and it has one, the
     * <code>stoppedFn</code> method is executed.  Note, this will not prevent
     * the default behavior or the "after" subscribers from being executed.</p>
     *
     * <p>Other publish configurations affect the notification behavior as
     * well, such as <code>async</code> and <code>queuable</code>.</p>
     *
     * @method eventDef.fire
     * @param host {Object} the instance from which fire was called
     * @param type {String} the event type to dispatch
     * @param args* {any} additional args passed <code>fire(type,
     *              <em>_here_...</em>)</code>
     * @static
     * @protected
     */
    fire: function (host, type) {
        var path  = this.resolveBubblePath(host),
            event = this.generateEvent.apply(this, arguments);
            
        // on() subscribers
        this.notify(path, event, "before");

        // default/stop/prevent behavior
        if (event._stop && this.stoppedFn) {
            this.stoppedFn.call(host, event);
        }

        if (this.preventable && event._prevent) {
            if (this.preventedFn) {
                this.preventedFn.call(host, event);
            }
        } else {
            if (this.defaultFn) {
                this.defaultFn.call(host, event);
            }

            // after() subscribers
            this.notify(path, event, "after");
        }

        // Reroute subscribe to immediate for fireOnce configurations.  This
        // creates a derived event definition on the instance to prevent
        // modifying a shared event definition.  See <code>immediate</code>.
        if (this.fireOnce && !this._firedWith) {
            host.publish({
                type      : type,
                subscribe : this.immediate,
                // cache the event it was initially fired with
                _firedWith: event
            });
        }
    },

    /**
     * <p>Flattens the bubble path for a given root instance.  Flattens using a
     * breadth-first algo, so given the following bubble structure:</p>
     * <pre>
     * . (D)  (E)   (D)  (F)
     * .    \  |     |  /
     * .     (B)     (C)       bubble up to
     * .        \   /
     * .         (A)           bubbles up to</pre>
     *
     * <p>The resulting bubble path would be [A, B, C, D, E, F], and not
     * [A, B, D, E, C, F] (depth-first).  Also note duplicate targets are
     * ignored.  The first appearance in the bubble path wins.</p>
     *
     * @method resolveBubblePath
     * @param root {Object} the origin of the event to bubble (A in the diagram)
     * @return {Array} the ordered list of target instances
     * @static
     * @protected
     */
    resolveBubblePath: function (root) {
        var path  = [root],
            known = [],
            i, j, target, clz;

        if (this.bubbles) {
            // Add to the end of the path as we iterate.  This creates a bubble
            // path where A's immediate bubble targets are all notified, then
            // each of their respective bubble targets are notified and so on.
            // (breadth first)
            for (i = 0; i < path.length; ++i) {
                target = path[i];

                // protect against infinite loops
                if (target._yuievt && arrayIndex(known, target) === -1) {
                    clz = target.constructor;
                    known.push(target);

                    if (target._yuievt && target._yuievt.bubblePath) {
                        path.push.apply(path, target._yuievt.bubblePath);
                    }

                    if (clz._yuievt && clz._yuievt.bubblePath) {
                        path.push.apply(path, clz._yuievt.bubblePath);
                    }
                }
            };

            // remove non-unique path entries.
            for (i = 0; i < path.length; ++i) {
                target = path[i];
                for (j = i + 1; j < path.length; ++j) {
                    if (path[j] === target) {
                        path.splice(j--, 1);
                    }
                }
            }
        }

        return path;
    },

    bubbles: true,

    /**
     * <p>Creates the event object that will be passed to the subscribers.  The
     * event has the following properties and methods:</p>
     * <ul>
     *     <li><code>type</code></li>
     *     <li><code>target</code></li>
     *     <li><code>preventDefault()</code></li>
     *     <li><code>_prevent</code> (reserved)</li>
     *     <li><code>stopPropagation()</code></li>
     *     <li><code>stopImmediatePropagation()</code></li>
     *     <li><code>_stop</code> (reserved)</li>
     *     <li><code>halt()</code> - stopPropagation() + preventDefault()</li>
     *     <li><code>detach()</code> - detaches the current subscriber</li>
     *     <li><code>details</code> - array of additional args passed to
     *         <code>fire(type, <em>_here_...</em>)</code></li>
     * </ul>
     *
     * <p>If the first additional argument is an object, its properties will be
     * added to the event object directly as well as being the object being
     * included in the <code>details</code> property.</p>
     *
     * <p>Before it is passed to subscribers, its <code>currentTarget</code> and
     * <code>subscription</code> properties are updated accordingly by the
     * <code>notify</code> method.</p>
     *
     * @method eventDef.generateEvent
     * @param host {Object} the instance from which on/after was called
     * @param type {String} the name of the event
     * @param args* {any} additional data provided to subscribers.
     * @return {Object} the event object
     * @static
     * @protected
     */
    generateEvent: function (host, type, payload) {
        var data = (isObject(payload)) ? payload : {};

        data.target  = data.target || host;
        data.details = toArray(arguments, 2, true);

        return new this.Event(type, data);
    },

    /**
     * The event facade class to use when firing an event.  Fire generates a
     * single event object that is passed to each subscriber in turn.
     *
     * @property eventDef.Event
     * @type {Function}
     */
    Event: EventFacade,

    /**
     * <p>Executes all the subscribers in a bubble chain for an event in a given
     * phase ("before" or "after").  Used by <code>fire</code>.</p>
     *
     * <p>If a subscriber calls <code>e.stopImmediatePropagation()</code>, no
     * further subscribers will be executed, and if a subscriber calls
     * <code>e.stopPropagation()</code>, no further bubble targets will be
     * notified.</p>
     *
     * @method eventDef.notify
     * @param path {Array} bubble targets in the order they should be notified
     * @param event {Object} the event to pass to the subscribers
     * @param phase {String} the phase location of the subscribers
     * @static
     * @protected
     */
    notify: function (path, event, phase) {
        var args = toArray(event), // support event facade or list of 0..n args
            type = event.type,
            target, subs, sub, i, len, j, jlen;

        for (i = 0, len = path.length; i < len; ++i) {
            target = path[i];
            subs   = this.getSubs(target, type, null, phase);

            if (subs.length) {
                event.currentTarget = target;

                for (j = 0, jlen = subs.length; j < jlen; ++j) {
                    sub = subs[j];
                    // facilitate e.subscriber.detach();
                    event.subscription = sub;

                    sub.notify.apply(sub, args);

                    delete event.subscription;

                    if (event._stop > 1) {
                        break;
                    }
                }

                if (event._stop) {
                    break;
                }
            }
        }
    },

    preventable: true,

    /**
     * Replacement for the subscribe method on fireOnce events after they've
     * fired.  Immediately executes the would be subscription.
     *
     * @method eventDef.immediate
     * @param args {Object} the instance from which on/after was called
     * @return {boolean} false (prevents formal subscription)
     * @static
     * @protected
     */
    immediate: function (args) {
        // FIXME: This needs attention.  Probably can be done with less code.
        var extra = this.processArgs && this.processArgs(args),
            sub   = this.generateSub.apply(this, args),
            event = this._firedWith,
            abort;

        if (extra) {
            sub._extra = extra;
        }

        if (this.on) {
            abort = this.on.apply(this, args);
        }

        abort = abort || (sub.phase === "after" &&
                          this.preventable      &&
                          event._prevent);

        if (!abort) {
            event.subscription = sub;
            event.currentTarget = args[0];
            sub.callback.apply(sub.thisObj, [event].concat(sub.payload));
        }
    },

    /**
     * Get all subscriptions matching the provided type, phase, and
     * category.  If type is omitted, all subs (in the category if
     * provided) are returned.  Note, phase is omitted in this case.  If
     * type is provided and phase is omitted, all subscriptions for that
     * type in all phases are returned.
     *
     * @method getSubs
     * @param type {string} (optional) the event type
     * @param cat {string} (optional) subscription category
     * @param phase {string} (optional) subscription phase
     * @return {Array}
     */
    getSubs: function (target, type, cat, phase) {
        var store, subs;

        if (target._yuievt) {
            store = (cat) ? target._yuievt.cats[cat] : target._yuievt.subs;

            if (store && store[type]) {
                if (phase) {
                    subs = store[type] && store[type][phase];
                } else {
                    subs = [];
                    YObject.each(store[type], function (psubs) {
                        subs.push.apply(subs, psubs);
                    });
                }
            }
        }

        return subs ? subs.slice() : [];
    },

    /**
     * <p>Returns true if there are any subscriptions in a given phase for
     * a particular event.  If no phase is specified, all phases are
     * checked.</p>
     *
     * <p>The type string alone will be used to identify the event whose
     * <code>fire</code> definition should be used, and will not be
     * compared against conditional events' <code>test(..)</code>
     * methods.</p>
     *
     * @method hasSubs
     * @param type {String} the name of the event
     * @param phase {String} (optional) the phase in which to check
     * @param category {String} (optional) the category in which to check
     * @return {boolean}
     */
    hasSubs: function (host, type, phase, category) {
        return this.getSubs(host, type, phase, category).length > 0;
    },

    /**
     * <p>Subscription tear down or other work that needs to happen each time
     * a subscription detach is requested.  If the method returns true, the
     * subscription will be detached.  Return true to abort the detach.</p>
     * 
     * @method eventDef.unsubscribe
     * @param host {Object} the instance from which on/after was called
     * @param sub {Object} the subscription to detach
     * @param args* {any} additional arguments passed to <code>detach(..)</code>
     * @return {boolean} true to detach, false to abort
     * @static
     * @protected
     */
    unsubscribe: function (host, type, category, phase, callback) {
        var subs, abort, i, len, sub;

        if (type.detach) {
            if (this.detach) {
                abort = this.detach(host, type);
            }
            if (!abort) {
                this.unregisterSub(host, type);
            }
            type = type.type;
        } else {
            subs = this.getSubs.apply(this, arguments);
            
            for (i = 0, len = subs.length; i < len; ++i) {
                sub = subs[i];
                if (!callback || sub.callback === callback) {
                    if (this.detach) {
                        abort = this.detach(host, sub);
                    }
                    if (!abort) {
                        this.unregisterSub(host, sub);
                    }
                }
            }
        }

        // TODO: this allows destroy to be called when there were no subs to
        // begin with.  That doesn't seem right.
        if (this.destroy && !this.hasSubs(host, type)) {
            this.destroy(this, type);
        }
    }

    /**
     * Final one-time tear down after the last subscriber is detached.
     *
     * @method eventDef.destroy
     * @param host {Object} the instance from which on/after was called
     * @param type {String} the event to tear down
     * @param args* {any} any additional arguments passed on(type, _here_...)
     * @return {boolean} true to allow subscription, false to abort
     * @static
     * @protected
     */
};

function Subscription(args, details) {
    this.host     = args[0];
    this.type     = args[1];
    //FIXME: get rid of category
    //this.category = cat;
    this.phase    = args[2];
    this.callback = args[3];
    this.thisObj  = args[4] || args[0];
    this.payload  = args.slice(5);
    this.details  = details;
}
Subscription.prototype = {
    notify: function () {
        var args = arguments;
        
        if (this.payload.length) {
            args = toArray(args, 0, true);
            args.push.apply(args, this.payload);
        }

        this.callback.apply(this.thisObj, args);
    },
    detach: function () {
        this.host.detach(this);
    }
};

function EventFacade(type, data) {
    this.type = type,
    this.data = data || {};
}
function fromProperty(name) { return this[name]; }
EventFacade.prototype = {
    _getter: {
        type   : fromProperty,
        details: fromProperty
    },

    _setter: {},

    _prevent: false,
    _stop   : 0,

    preventDefault: function () {
        this._prevent = true;
    },

    stopPropagation: function () {
        this._stop = 1;
    },

    stopImmediatePropagation: function () {
        this._stop = 2;
    },

    halt: function () {
        this.preventDefault();
        this.stopPropagation();
    },

    detach: function () {
        this.subscription.detach();
    },

    get: function (name) {
        return (this._getter[name]) ?
            this._getter[name](name) :
            this.data[name];
    },

    set: function (name, val) {
        if (this._setter[name]) {
            this._setter[name](name, val);
        } else {
            this.data[name] = val;
        }
    }
};

Y.mix(EventTarget, {
    /**
     * Pattern used to split detach category from event type.  By default,
     * It matches <code>on("foo|bar",..)</code> as category "foo" and type
     * "bar", and <code>on("baz",..)</code> as category "" and type as "baz".
     *
     * @property _TYPE_PATTERN
     * @type {Regexp}
     * @default /(?:([^|]+?)\|)?(.*)/
     * @static
     * @private
     */
    _TYPE_PATTERN: /(?:([^|]+?)\|)?(.*)/,

    /** 
     * Set up the event infrastructure for a class.  If the class hosts an
     * EVENTS static property, it will be used to seed the known events for all
     * class instances.  Optionally supply an object of event definitions for
     * this purpose.
     *
     * @method Event.initEvents
     * @param events {Object} (optional) collection of event definitions
     * @static
     */
    initEvents: function (target, events, config) {
        if (!target._yuievt) {
            events = events || {};

            target._yuievt = {
                subs      : {},
                cats      : {},
                events    : { _DEFAULT: new Y.CustomEvent() },
                conEvents : {},
                bubblePath: []
            };

            // TODO: Adding a new static method seems a little invasive.
            target.publish = EventTarget.publish;
        }

        if (config) {
            Y.mix(target._yuievt, config);
        }

        if (events) {
            EventTarget._publish(target, events);
        }
    },

    publish: function (eventDef, o) {
        return EventTarget._publish(this, eventDef, o);
    },

    _publish: function (host, eventDef, o) {
        // TODO: Add support for publish("foo", FooClass) that just instantiates
        // FooClass?
        switch (YLang.type(eventDef)) {
            case "object":
                if (eventDef.type) {
                    break;
                } else {
                    YObject.each(eventDef, function (def, type) {
                        this._publish(host, Y.mix(def, { type: type }));
                    }, this);
                    return this;
                }
            case "string":
                return this._publish(host, Y.mix((o || {}), { type: eventDef }));
            default :
                return this;
        }

        // At this point, eventDef should be an object with type and
        // optionally pattern or test properties.
        var type = eventDef.type,
            events, known, BaseClass, EventClass;

        if (type) {
            if (eventDef.pattern && !eventDef.test) {
                // Memoize a test function for the regex
                eventDef.test = Y.cached(function (type) {
                    return this.pattern.test(type);
                });
            }

            events = host._yuievt.events;

            known = events[type];

            if (known && owns(events, type)) {
                // Update definition

                // TODO: init and subscribe for each existing sub?  Is
                // there any reasonable way to discover if this is needed?
                Y.mix(known, eventDef, true);
            } else {
                base = events[type] || events._DEFAULT;
                BaseClass = (base) ? base.constructor : Y.CustomEvent;

                EventClass = function () {
                    BaseClass.apply(this, arguments);
                };
                Y.extend(EventClass, BaseClass, eventDef);

                events[type] = new EventClass();
            }

            if (events[type].test) {
                host._yuievt.conEvents[type] = events[type].test;
            }
        }

        return host;
    },

    prototype: {
        /**
         * Sets up the event state and subscription storage for this instance.
         *
         * @method _initEvents
         * @protected
         */
        _initEvents: function (events, config) {
            var classConfig = this.constructor._yuievt;
            
            this._yuievt = {
                subs      : {},
                cats      : {},
                events    : (classConfig) ? proto(classConfig.events) : {},
                conEvents : (classConfig) ? proto(classConfig.conEvents) : {},
                bubblePath: []
            };

            if (config) {
                Y.mix(this._yuievt, config);
            }

            if (events) {
                this.publish(events);
            }
        },

        /**
         * <p>Add a new event to this instance's collection of events.  Use
         * this to add an event with specific default behavior, preventedFn
         * behavior, or special subscription/detach logic (etc).  If the event
         * doesn't behave in any way different from the default, you don't have
         * to publish it.  If the event applies to all instances, define it in
         * the static <code>_events</code> collection for the class.</p>
         *
         * <p>Accepts an event definition object with properties and methods to
         * override those defined in the <code>defaultEvent</code>.  See the
         * description of <code>Y.Event.API.defaultEvent</code> for the
         * properties and methods to include.  Any methods or properties not
         * defined will be provided by the <code>defaultEvent</code>.</p>
         *
         * <p>If the <code>pattern</code> property is set to a regular
         * expression, it will be wrapped in a memoized <code>test</code>
         * function automatically.</p>
         *
         * <p>Include a <code>type</code> property in the event definition, or
         * pass the type string as the first parameter and the overrides as the
         * second.</p>
         *
         *
         * @method publish
         * @param eventDef {Object} collection of event methods/properties
         * @return {Object} the instance
         * @chainable
         */
        publish: function (eventDef, o) {
            return EventTarget._publish(this, eventDef, o);
        },

        /**
         * <p>Subscribe to an event on this object.  Subscribers in this
         * "before" phase will have access to prevent any default event
         * behaviors (if the event permits prevention).</p>
         *
         * <p>The first argument must be a type string identifying the event.
         * The string can include a detach category.  Additionally, if no event
         * specifically matches the type string, a conditional event might be
         * used if its <code>test(..)</code> method indicates a match.
         * Otherwise, the default event definition will be used for the
         * specified type.</p>
         *
         * <p>Individual events can define how the subscription params are
         * handled, but the default signature is
         * <code>on( type, callback, thisObj, arg0..argN )</code> where
         * <code>thisObj</code> will be used for 'this' in the callback, and
         * the additional arguments will be passed to the callback after the
         * event object.</p>
         *
         * @method on
         * @param type {String} event type to subcribe to, with optional detach
         *                      category
         * @param arg* {any} see above note on default signature
         * @return {Object} this instance
         * @chainable
         */
        on: function (type) {
            var args = toArray(arguments, 1, true);
            args.unshift(type, "before");

            return this._subscribe(args);
        },

        /**
         * <p>Subscribe to an event on this object.  Subscribers in this
         * "after" phase will NOT have access to prevent any default event
         * behaviors (if the event permits prevention), but will also not
         * be executed unless the default behavior executes.</p>
         *
         * <p>The first argument must be a type string identifying the event.
         * The string can include a detach category.  Additionally, if no event
         * specifically matches the type string, a conditional event might be
         * used if its <code>test(..)</code> method indicates a match.
         * Otherwise, the default event definition will be used for the
         * specified type.</p>
         *
         * <p>Individual events can define how the subscription params are
         * handled, but the default signature is
         * <code>after( type, callback, thisObj, arg0..argN )</code> where
         * <code>thisObj</code> will be used for 'this' in the callback, and
         * the additional arguments will be passed to the callback after the
         * event object.</p>
         *
         * @method after
         * @param type {String} event type to subcribe to, with optional detach
         *                      category
         * @param arg* {any} see above note on default signature
         * @return {Object} this instance
         * @chainable
         */
        after: function (type) {
            var args = toArray(arguments, 1, true);
            args.unshift(type, "after");

            return this._subscribe(args);
        },

        /**
         * <p>Subscribe to an event on this object.  This method is a catchall
         * for events that might support more than the standard "before" (aka
         * "on") and "after" phases.  This method allows for subscription to
         * any event phase.</p>
         *
         * <p>The first argument must be a phase string.  Passing the string
         * "before", for example, mimics the behavior of
         * <code>on(...)</code>.</p>
         *
         * <p>The second argument must be a type string identifying the event.
         * The string can include a detach category.  Additionally, if no event
         * specifically matches the type string, a conditional event might be
         * used if its <code>test(..)</code> method indicates a match.
         * Otherwise, the default event definition will be used for the
         * specified type.</p>
         *
         * <p>Individual events can define how the subscription params are
         * handled, but the default signature is
         * <code>subscribe(phase, type, callback, thisObj, arg0..argN)</code>
         * where <code>thisObj</code> will be used for 'this' in the callback,
         * and the additional arguments will be passed to the callback after
         * the event object.</p>
         *
         * @method subscribe
         * @param phase {String} event phase to attach subscription
         * @param type {String} event type to subcribe to, with optional detach
         *                      category
         * @param arg* {any} see above note on default signature
         * @return {Object} this instance
         * @chainable
         */
        subscribe: function () {
            return this._subscribe(toArray(arguments));
        },

        /**
         * Does the work for <code>on(..)</code>, <code>after(..)</code>, and
         * <code>subscribe(..)</code>.
         * 
         * @param args {Array} [type, phase, arg*] to identify and dispatch to
         *                      the appropriate event definition
         * @return {Object} this instance
         * @chainable
         * @protected
         */
        _subscribe: function (args) {
            var type = args[0],
                catAndType, category, eventDef;

            if (isString(type)) {
                catAndType = type.match(EventTarget._TYPE_PATTERN) || [];
                category = catAndType[1];

                type     = catAndType[2];
                eventDef = this.getEvent(type, args);

                args.splice(0, 1, this, type, category);

                eventDef.subscribe(args);

            // Handle signature overloading last to optimize the common case
            } else if (YLang.isArray(type)) {
                each(type, function (t) {
                    args[0] = t;
                    this._subscribe(args);
                }, this);
            } else if (isObject(type)) {
                YObject.each(type, function (arg2, t) {
                    args[0] = t;
                    args[2] = arg2;
                    this._subscribe(args);
                }, this);
            }

            return this;
        },

        /**
         * Finds the best match for the type specified, optionally testing
         * against any hosted conditional events.  If all else fails, the
         * default event definition is returned.
         *
         * @method getEvent
         * @param type {String} the name of the event
         * @param match {Array} (optional) additional args to pass to
         *                      <code>test(..)</code> to match against any
         *                      hosted conditional events
         * @return {Object} an event definition object
         */
        getEvent: function (type, match) {
            var config   = this._yuievt || this.constructor._yuievt,
                eventDef = (config) ? config.events[type] : null,
                events, k, def;

            if (!eventDef && config && match && isString(type)) {
                // don't modify the match args directly.  Copy first.
                match = match.slice(2);
                match.unshift(this, type);
                events = config.conEvents;
                for (k in events) {
                    def = events[k];
                    if (def.subscribe && def.test &&
                        def.test.apply(def, match)) {
                        eventDef = def;
                        break;
                    }
                }
            }

            return eventDef || config.events._DEFAULT;
        },

        /**
         * <p>Trigger the execution of subscribers to a specific event.  The
         * particular logic used for the notification is defined in the event
         * definition's <code>fire(..)</code> method.  If not specified there,
         * the default event's <code>fire(..)</code method is used.</p>
         *
         * <p>As noted in <code>eventDef.fire</code>, the global default
         * event's <code>fire</code> executes the "before" (aka "on") phase
         * subscribers, then the event's default behavior if it has one, then
         * the "after" phase subscribers, but this can be overridden per
         * event.  More detail is available in the API doc for
         * the (protected) <code>eventDef.fire</code> method.</p>
         *
         * <p>The type string alone will be used to identify the event whose
         * <code>fire</code> definition should be used, and will not be
         * compared against conditional events' <code>test(..)</code>
         * methods.</p>
         * 
         * @method fire
         * @param type {String} the type identifying the event whose
         *                      <code>fire(..)</code> to use.
         * @param args* {any} extra arguments to pass along
         * @return {Object} this instance
         * @chainable
         */
        fire: function (type) {
            var eventDef = this.getEvent(type),
                args = toArray(arguments, 0, true);

            args.unshift(this);

            eventDef.fire.apply(eventDef, args);

            return this;
        },

        /**
         * <p>Unsubscribe one or multiple subscribers.  Some example signatures
         * are:</p>
         * <table>
         *     <thead>
         *         <tr><th>Called with</th><th>What is detached</th></tr>
         *     </thead>
         *     <tbody>
         *         <tr>
         *             <td><code>detach()</code></td>
         *             <td>All subscriptions to all events in all phases</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach(subscriptionObject)</code></td>
         *             <td>That subscription</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach("foo")</code></td>
         *             <td>All subscriptions to event "foo" in all phases</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach("foo", "before")</code></td>
         *             <td>All subscriptions to event "foo" in the "before"
         *                 phases</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach("foo", "before", callbackFunc)*</code></td>
         *             <td>All subscriptions to event "foo" in the "before"
         *                 phase that are bound to callbackFunc  (*See below for
         *                 notes)</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach("cat:*")</code></td>
         *             <td>All subscriptions to all events in all phases that
         *                 were subscribed with category "cat" (e.g.
         *                 <code>on("cat:foo", ...)</code>)</td>
         *         </tr>
         *         <tr>
         *             <td><code>detach("cat:foo")</code></td>
         *             <td>All subscriptions to event "foo" in all phases that
         *                 were subscribed with category "cat"</td>
         *         </tr>
         *     </tbody>
         * </table>
         *
         * <p>Note, parameters beyond the type and phase are passed to the
         * event's <code>match</code> method to apply any signature
         * specific filtration for the subscriber list, so the detach signature
         * that passes the callback is just an example of the signature
         * supported by the default event.</p>
         *
         * @method detach
         * @param typeSpec {Object|String} (optional) event subscription object
         *                      or event type string, optionally with category
         * @param phase {String} (optional) phase from which to detach
         * @param args* {any} additional arguments used by the event's
         *                      <code>match</code> method to better
         *                      isolate which sub(s) to detach.
         * @return {Object} this instance
         * @chainable
         */
        detach: function (typeSpec) {
            var args = toArray(arguments, 0, true),
                eventDef, catAndType, type, category;

            args.unshift(this);

            if (typeSpec && typeSpec.detach) {
                eventDef = this.getEvent(typeSpec.type);
                eventDef.unsubscribe.apply(eventDef, args);
            } else {
                catAndType = (typeSpec || '*')
                                .match(EventTarget._TYPE_PATTERN) || [];
                category   = catAndType[1];
                type       = catAndType[2];

                if (type && type !== '*') {
                    eventDef = this.getEvent(type);

                    args.splice(1, 1, type, category);

                    eventDef.unsubscribe.apply(eventDef, args);
                } else {
                    this.detachAll(category);
                }
            }
            
            return this;
        },

        detachAll: function (category) {
            // TODO/FIXME: this is the only place in the API  where knowledge
            // of the subscription storage structure is required
            var subs = (category) ?
                        this._yuievt.cats[category] : this._yuievt.subs,
                type, eventDef;

            if (subs) {
                for (type in subs) {
                    if (owns(subs, type)) {
                        eventDef = this.getEvent(type);
                        eventDef.unsubscribe(this, type);
                    }
                }
            }

            return this;
        },

        /**
         * Add a bubble target, allowing subscriptions from the bubble target
         * for events emitted by this object.
         *
         * @method addTarget
         * @param target {Object} instance of an object augmented with Event.API
         * @return {Object} this instance
         * @chainable
         */
        addTarget: function (target) {
            if (!this._yuievt) {
                this._initEvents();
            }

            if (arrayIndex(this._yuievt.bubblePath, target) === -1) {
                this._yuievt.bubblePath.push(target);
            }

            return this;
        }
    }
}, true);

Y.mix(Y.namespace("EventX"), {
    CustomEvent: CustomEvent,
    Facade     : EventFacade,
    Target     : EventTarget,
    pushByPath : pushByPath
});

Y.CustomEvent = CustomEvent;
Y.EventFacade = EventFacade;
Y.EventTarget = EventTarget;

EventTarget.initEvents(EventTarget);



// Add the API to Y
// TODO: submodule?
Y.mix(Y, EventTarget.prototype, true);
EventTarget.call(Y, {
    _DEFAULT: {
        // Allow Y.on/after/subscribe behavior to be extensible.  E.g. if
        // eventx-node is loaded, it will redirect Y.on('click', fn, '.foo')
        // to Y.all('.foo').on('click', fn);  Similarly with Y.Do, and raw
        // DOM subscriptions
        init: function () {
            if (this.type === '_DEFAULT') {
                var args     = arguments,
                    override = this.getSubOverride(args);

                return (override) ? this[override].apply(this, args) : true;
            }
        },

        getSubOverride: function (args) {
            var host      = args[0],
                overrides = host._yuievt.subOverrides,
                method;

            for (method in overrides) {
                if (owns(overrides, method) &&
                    overrides[method].apply(this, args)) {
                    return method;
                }
            }

            return null;
        }
    }
}, {
    subOverrides: {},
    detachOverrides: {}
});


Y.before = function () {
    return Y.Do.before.apply(Y.Do, arguments);
};

}, '0.0.1', { requires: ['oop'] });
