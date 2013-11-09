var isArray = Y.Lang.isArray,
    toArray = Y.Array,

    FacadeEvent = Y.CustomEvent.FacadeEvent,

    EVENT_NAMES =
        ('abort beforeunload blur change click close command contextmenu ' +
         'dblclick DOMMouseScroll drag dragstart dragenter dragover ' +
         'dragleave dragend drop error focus key keydown keypress keyup load ' +
         'message mousedown mouseenter mouseleave mousemove mousemultiwheel ' +
         'mouseout mouseover mouseup mousewheel orientationchange reset ' +
         'resize select selectstart submit scroll textInput unload').split(' '),
    DOM_EVENTS = {},
    DOMEvent,

    ON      = 'on',
    CAPTURE = 'capture',

    webkitKeymap = {
        63232: 38, // up
        63233: 40, // down
        63234: 37, // left
        63235: 39, // right
        63276: 33, // page up
        63277: 34, // page down
        25:     9, // SHIFT-TAB (Safari provides a different key code in
                   // this case, even though the shiftKey modifier is set)
        63272: 46, // delete
        63273: 36, // home
        63275: 35  // end
    },

    isSelectorMatch = Y.Selector.test,

    events, name, i, len;

Y.Event = {
    /**
    DOM and synthetic event collection for sharing between Y, Node, and
    NodeList.

    @property DOM_EVENTS
    @type {Object}
    **/
    // populated below
    DOM_EVENTS: DOM_EVENTS,

    /**
    The custom event definition (prototype) used to handle DOM events.
    Modifying this will alter the behavior of all DOM events.

    @property DOMEvent
    @type {CustomEvent}
    **/
    // defined below
    //DOMEvent: DOMEvent,

    /**
    The event facade class used by DOMEvent (aka DOMEventFacade).

    @property EventFacade
    @type {Event.EventFacade}
    **/
    // defined below
    //EventFacade: DOMEventFacade,

    /**
    Whitelist an existing DOM event, customize the behavior of a whitelisted
    event, or publish a synthetic DOM event that will masquerade as a DOM event
    throughout the system.

    @method publish
    @param {String} type Name of the event
    @param {Object|CustomEvent} [config] Event overrides or CustomEvent instance
    @param {CustomEvent} [inheritsFrom] Event to use as the prototype before
                            customizations in _config_ are applied
    **/
    publish: function (type, config, inheritsFrom, smart) {
        // Default DOMEvent for Y.Event.publish('beforeunload') use case to
        // make it easy to whitelist existing DOM events. Don't default
        // DOMEvent for others because synthetic events have custom behavior
        // and should relate to DOMEvent behavior only on an as-needed basis,
        // and likely via the EventTarget API on Node/Y.
        if (arguments.length === 1) {
            Y.Event.DOM_EVENTS[type] = Y.Event.DOMEvent;
        } else {
            Y.EventTarget._publish(Y.Event, Y.Event.DOM_EVENTS,
                type, config, inheritsFrom, smart);
        }
    },

    /**
    Remove all DOM event subscriptions from _target_, optionally also purging
    subscriptions of _target_'s subtree. Specify a _type_ to limit detaching to
    a specific event.

    _target_ can be a selector string, Node, NodeList, HTMLElement, or array
    of HTMLElements.

    @method purgeElement
    @param {String|Node|NodeList|Element|Element[]} target What to purge
    @param {Boolean} [recurse] If truthy, also purge all descendants
    @param {String} [type] Limit purge to this event
    **/
    purgeElement: function (target, recurse, type) {
        var yuid, i, len, subs, eventKey;

        target = Y.Event._resolveTarget(target);

        if (target) {
            if (target.nodeType) {
                yuid = Y.stamp(target);

                if (recurse) {
                    // purge children, but don't return because we still need
                    // to purge the target
                    Y.Event.purgeElement(
                        target.getElementsByTagName('*'), false, type);
                }

                if (type) {
                    Y.detach(type, null, target);
                } else {
                    subs = Y._yuievt.subs;

                    for (eventKey in subs) {
                        if (eventKey.indexOf(yuid) === 0) {
                            Y.detach(
                                eventKey.slice(eventKey.lastIndexOf(':') + 1),
                                null, target);
                        }
                    }
                }
            } else if (target.length) {
                for (i = 0, len = target.length; i < len; ++i) {
                    Y.Event.purgeElement(target[i], recurse, type);
                }
            }
        }
    },

    /**
    Direct DOM event subscription, bypassing synthetic events or custom
    overrides for a particular event.

    Like `Y.on()`, the _target_ argument accepts a CSS selector string or a
    DOM element, element collection or array, Node, or NodeList.

    @method attach
    @param {String} type Event name
    @param {Function} callback Callback function to receive the event
    @param {HTMLElement|HTMLElement[]|Node|NodeList|String} target Element or
        elements hosting the event to subscribe to.
    @param {Object} [thisObj] Override `this` in the callback. Defaults to the
        subscribed target.
    @param {Any} arg* Additional arguments to be passed to _callback_ after the
        event facade.
    @return {Subscription}
    **/
    attach: function () {
        return DOMEvent
                .subscribe(Y, toArray(arguments, 0, true), { phase: 'on' });
    },

    /**
    Resolves the input value to a DOM Element or array of DOM Elements.

    If unsuccessful, `null` is returned.

    If no target is passed, `Y.config.win` is returned.

    @method _resolveTarget
    @param {String|Node|NodeList|Element|Element[]} target
    @return {Element|Element[]}
    @protected
    **/
    _resolveTarget: function (target) {
        if (!target || target === Y.config.win) {
            return Y.config.win;
        } else if (typeof target === 'string') {
            target = Y.Selector.query(target);

            if (target.length === 1) {
                return target[0];
            } else if (target.length > 1) {
                return target;
            }
        } else if (target.nodeType || (target[0] && target[0].nodeType)) {
            return target;
        } else if (Y.Node) {
            if (target instanceof Y.Node) {
                return target._node;
            } else if (target instanceof Y.NodeList) {
                return target._nodes;
            } else if (target[0] && target[0] instanceof Y.Node) {
                return Y.all(target)._nodes;
            }
        }

        if (isArray(target) && !target.length) {
            return target;
        }

        return null;
    },

    /**
    Routes a DOM event to the Notifier responsible for calling the DOM event
    subscribers.

    @method _handleEvent
    @param {DOMEvent} e the native DOM event
    **/
    _handleEvent: function (e) {
        // Inlined for old IE support rather than breaking out into submodule.
        // The quantity of code just isn't worth it.
        if (!e) {
            e = event;
        }

        // fire('click', rawDOMEvent, clickedDOMElement)
        Y.fire(e.type, e, this);
    }
};

function DOMEventFacade(config) {
    this._event        = config._event;
    this.currentTarget = config.currentTarget;
}

Y.Event.EventFacade.prototype = {
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
    Disables any default behavior of the event.

    @method preventDefault
    @chainable
    **/
    preventDefault: function () {
        this.prevented = true;

        if (this._event.preventDefault) {
            this._event.preventDefault();
        }

        this._event.returnValue = false;

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

            if (this._event.stopPropagation) {
                this._event.stopPropagation();
            }

            this._event.cancelBubble = true;
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

        if (this._event.stopPropagation) {
            this._event.stopPropagation();
        }

        this._event.cancelBubble = true;

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
        this[immediate ? 'stopImmediatePropagation' : 'stopPropagation']()
            .preventDefault();

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
    }
};

// TODO: split the getter implementation off to a conditional module? Use a
// conditional module for each implementation, getter or no-getter?
function propertySetter(prop) {
    return function (val) {
        Object.defineProperty(this, prop, {
            value       : val,
            writable    : true,
            configurable: true
        });
    };
}

function lazyProp(prop) {
    return {
        // Not enumerable
        configurable: true,
        // getter reads from the native event, setter reconfigures property as
        // a simple property with no getter/setter
        get: function () {
            return this._event[prop];
        },
        set: propertySetter(prop)
    }
}

function getKeyCode(prop) {
    return {
        configurable: true,
        get: function () {
            var code = this._event.keyCode || this._event.charCode;

            return webkitKeymap[code] || code;
        },
        set: propertySetter(prop)
    };
}

function getWhich(prop) {
    return {
        configurable: true,
        get: function () {
            // fall back to the keyCode getter
            return this._event.which || this._event.charCode || this.keyCode;
        },
        set: propertySetter(prop)
    };
}

// definePropertIES to avoid IE8's bustedness
if (Object.defineProperties) {
    Object.defineProperties(DOMEventFacade.prototype, {
        target: {
            configurable: true,
            get: function () {
                // IE 9 moved to the standard event model and added
                // defineProperties, so if the code got here, srcElement is dead
                var el = this._event.target;

                // lazy text node resolution
                // TODO: is the while() loop necessary? I copied it from the
                // current event source, but text nodes can't have children.
                // So either it's unnecessary or it is addressing an
                // undocumented browser bug.
                while (el.nodeType === 3) {
                    el = el.parentNode;
                }

                // TODO: it kinda sucks that e.target will incur overhead for
                // each retrieval, but it's either that or reconfigure the
                // property without a getter/setter on first fetch, which
                // makes the first fetch slower. The choice is between
                // preferring callbacks that fetch e.target once or multiple
                // times. The overhead is minor in either case, but this is
                // core code and will be executed a lot.
                return el;
            },
            set: propertySetter('target')
        },
        type         : lazyProp('type'),
        relatedTarget: lazyProp('relatedTarget'),
        altKey       : lazyProp('altKey'),
        ctrlKey      : lazyProp('ctrlKey'),
        shiftKey     : lazyProp('shiftKey'),
        metaKey      : lazyProp('metaKey'),
        clientX      : lazyProp('clientX'),
        clientY      : lazyProp('clientY'),
        pageX        : lazyProp('pageX'),
        pageY        : lazyProp('pageY'),

        // charCode is unknown in keyup, keydown.
        // keyCode is unknown in keypress.
        // FF 3.6 - 8+? pass 0 for keyCode in keypress events.
        // Webkit, FF 3.6-8+?, and IE9+? pass 0 for charCode in keydown, keyup.
        // Webkit and IE9+? duplicate charCode in keyCode.
        // Opera never sets charCode, always keyCode (though with the charCode).
        // IE6-8 don't set charCode or which.
        // All browsers other than IE6-8 set which=keyCode in keydown, keyup,
        // and which=charCode in keypress.
        //
        // Moral of the story: (e.which || e.keyCode) will always return the
        // known code for that key event phase. e.keyCode is often different in
        // keypress from keydown and keyup.
        keyCode : getKeyCode('keyCode'),
        charCode: getKeyCode('charCode'),
        which   : getWhich('which'),
        button  : getWhich('button'),
        wheelDelta: {
            get: function () {
                var detail, delta;

                if (this.type === 'mousewheel' ||
                    this.type === 'DOMMouseScroll') {
                    detail = this._event.detail;
                    delta  = this._event.wheelDelta;

                    delta = -detail || Math.round(delta / 80) ||
                                        ((delta < 0) ? -1 : 1);
                }

                // Reconfigure the property as a simple property with no getter
                // or setter to avoid the calculation code above for multiple
                // fetches of e.wheelDelta.
                Object.defineProperty(this, 'wheelDelta', {
                    value       : val,
                    writable    : true,
                    configurable: true
                });

                return delta;
            },
            set: propertySetter('wheelDelta')
        },
        container: {
            configurable: true,
            get: function () {
                return this.subscription &&
                       this.subscription.details &&
                       this.subscription.details.container;
            },
            setter: propertySetter('container')
        }
    });
}

Y.Event.DOMEvent = DOMEvent = new Y.CustomEvent({
    subscribe: function (target, args, details) {
        args = toArray(args, 0, true);

        // details._sigParsed is to avoid duplicate parsing if target resolves
        // to multiple elements, and subscribe is recalled in a loop.
        if (this.parseSignature && !details._sigParsed) {
            this.parseSignature(target, args, details);
            details._sigParsed = true;
        }

        var type    = args[0],
            capture = (details.phase === CAPTURE),
            sub, el, eventKey, subs, i, len, abort;

        if (target === Y) {
            // Y.on(type, fn, target, thisObj) => target.on(type, fn, thisObj)
            target = args.splice(2,1)[0];
        }

        // Target could be a DOM element, DOM collection, Node, NodeList, or
        // selector that resolves to one or multiple elements.
        el = this.resolveTarget(target);

        // Only create a subscription for an individual element
        if (el && (el.nodeType || el === Y.config.win)) {
            // There are only two phases for DOM events
            phase = capture ? CAPTURE : ON;

            // Because the subscription type is overridden with the target yuid
            // plus the type, store the original type for the native DOM sub
            details.domType = type;

            // Delegate subs should have the filter parsed out of the args, and
            // other setup as needed. See delegate()
            if (details.delegate) {
                this.delegate(el, args, details);
            } else if (!args[2]) {
                // Default thisObj via function returning the currentTarget
                args[2] = this.thisObjFn;
            }

            // For uniqueness and matching the native event back to the
            // wrapping custom event, the Subscription is given a created type.
            eventKey = args[0] = Y.stamp(el) + ':' + type;

            sub   = new this.Subscription(Y, args, details);
            abort = this.preventDups && this.isSubscribed(Y, sub);

            if (!abort) {
                // Custom behavior for derived events (e.g. SyntheticEvent)
                if (this.on) {
                    abort = this.on(el, sub);
                }

                if (!abort) {
                    // Yay, the subscription is official!
                    this.registerSub(el, sub);
                } else if (abort.detach) {
                    // this.on() returned an alternate Subscription object
                    sub   = abort;
                    abort = null;
                }
            }
        } else if (el && typeof el.length === 'number') {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                // args[0] is assigned the eventKey. Need to reset it.
                args[0] = type;
                subs.push(
                    this.subscribe(el[i], args.slice(), Y.merge(details)));
            }

            // Return batch subscription
            sub = new Y.BatchSubscription(subs);
        }

        return abort ? null : sub;
    },

    // Aliased on the event object to allow Widget to override for support of
    // DOM events, having the target resolve to the Widget's boundingBox
    resolveTarget: Y.Event._resolveTarget,

    thisObjFn: function (e) {
        return e.currentTarget;
    },

    delegate: function (target, args, details) {
        if (!args[3]) {
            args[3] = this.thisObjFn;
        }

        FacadeEvent.delegate.apply(this, arguments);

        // To support the edge case of DOM delegation when Node is not loaded,
        // set the thisObj for delegateNotify to be Y, which hosts a getEvent
        // method to allow it to resolve the bubble path for raw DOM element
        // targets (not Nodes, which are EventTargets with getEvent). See
        // delegateNotify.
        args[2] = Y;
    },

    delegateNotify: function (e) {
        var sub     = e && e.subscription,
            details = sub && sub.details,
            filter  = details && details.filter,
            isSelectorFilter, target, event, path, container, match;

        if (filter) {
            isSelectorFilter = (typeof details.filter === 'string');
            container = details.container;
            target    = e._event.target || e._event.srcElement;

            do {
                if (isSelectorFilter) {
                    match = isSelectorMatch(target, filter,
                                (target === container ? null : container));
                } else {
                    e.currentTarget = Y.one ? Y.one(target) : target;

                    match = filter.call(sub, e);
                }

                if (match) {
                    // This duplicates Node creation for filter functions,
                    // which is making something slow even slower, but filter
                    // functions for DOM delegation are best rolled into on()
                    // handler logic. Not that that shoud justify punishing
                    // this code path's performance.
                    e.currentTarget = Y.one ? Y.one(target) : target;

                    // arguments contains e, which has had its currentTarget
                    // updated.
                    details.originalSub.notify(arguments);
                }

                target = target.parentNode;
            } while (!e.stopped && target && target !== container);
        }
    },

    registerSub: function (target, sub) {
        var type    = sub.details.domType,
            subs    = Y._yuievt.subs,
            capture = (sub.details.phase === CAPTURE),
            phase   = capture ? CAPTURE : ON;

        subs = subs[sub.type] || (subs[sub.type] = {});

        subs = subs[phase] || (subs[phase] = []);

        subs.push(sub);

        // First subscription needs a DOM subscription
        if (subs.length === 1) {
            this._addDOMSub(target, type, capture);
        }
    },

    unsubscribe: function (target, args) {
        var type  = args[0],
            el, eventKey, capture, phase, i, len, subs;

        // use case: target.detach(sub);
        if (type.type && type.callback) {
            // Explicitly override target to Y. All DOM events are stored on Y.
            return FacadeEvent.unsubscribe(Y, args);
        }

        // use case: Y.detach(type, callback, target);
        if (target === Y) {
            args   = toArray(args, 0, true);
            target = args.splice(2, 1)[0];
        }

        el = this.resolveTarget(target);

        if (el && el.nodeType) {
            eventKey = Y.stamp(el) + ':' + type;
            capture  = (args[2] === CAPTURE);
            phase    = capture ? CAPTURE : ON;
            subs     = Y._yuievt.subs;

            FacadeEvent.unsubscribe.call(this, Y,
                [eventKey, args[1], phase]);

            // No more subs, remove the DOM subscription
            if (!subs[eventKey] || !subs[eventKey][phase]) {
                this._removeDOMSub(el, type, capture);
            }
        } else if (el && el.length) {
            for (i = 0, len = el.length; i < len; ++i) {
                this.unsubscribe(el[i], args);
            }
        }
    },

    fire: function (target, type, event, currentTarget) {
        var eventKey = Y.stamp(currentTarget) + ':' + type,
            phase    = (event.eventPhase === 1) ? CAPTURE : ON,
            subs     = Y._yuievt.subs[eventKey],
            e, i, len, sub, ret;

        subs = subs && subs[phase];

        // This shouldn't happen because the last detached sub should
        // trigger the DOM sub being removed, but just in case...
        if (!subs) {
            return;
        }

        e = new this.Event({
            _event       : event,
            currentTarget: currentTarget
        });

        for (i = 0, len = subs.length; i < len; ++i) {
            sub = subs[i];

            e.subscription = sub;

            ret = sub.notify([e]);

            e.subscription = null;

            // Boy I hate this "feature"
            if (ret === false) {
                e.halt();
            }

            if (e.stopped === 2) {
                break;
            }
        }
    },

    Event: DOMEventFacade,

    _addDOMSub: function (el, type, capture) {
        YUI.Env.add(el, type, Y.Event._handleEvent, capture);
    },

    _removeDOMSub: function (el, type, capture) {
        YUI.Env.remove(el, type, Y.Event._handleEvent, capture);
    }
}, FacadeEvent);

// Populate the Y.Event.DOM_EVENTS whitelist, that will also serve as the
// prototype for the events collection for Y, Node, and NodeList.
for (i = 0, len = EVENT_NAMES.length; i < len; ++i) {
    DOM_EVENTS[EVENT_NAMES[i]] = DOMEvent;
}

// Replace the events map for Y to include DOM events, allowing
// Y.Event.publish(...) to add to Y's collection via prototypal inheritance.
events = Y._yuievt.events;
Y._yuievt.events = Y.Object(Y.Event.DOM_EVENTS);

for (name in events) {
    // ignore hasOwnProperty in favor of duck typing CustomEvent or Router
    if (events[name].subscribe) {
        Y._yuievt.events[name] = events[name];
    }
}
