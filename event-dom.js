YUI.add('eventx-dom', function (Y) {

var isArray = Y.Lang.isArray,
    toArray = Y.Array,
    push    = Array.prototype.push,

    eventTestTags = {
        select: 'input',
        change: 'input',
        submit: 'form',
        reset : 'form',
        error : 'img',
        load  : 'img',
        abort : 'img'
    },

    EVENT_NAMES = 'abort beforeunload blur change click close command contextmenu dblclick DOMMouseScroll drag dragstart dragenter dragover dragleave dragend drop error focus key keydown keypress keyup load message mousedown mouseenter mouseleave mousemove mousemultiwheel mouseout mouseover mouseup mousewheel orientationchange reset resize select selectstart submit scroll textInput unload'.split(' '),
    DOM_EVENTS = {},
    DOMEvent,

    events, event;

function DOMEventFacade(type, target, payload) {
    this._event = payload._event;

    Y.EventFacade.apply(this, arguments);
}

Y.extend(DOMEventFacade, Y.EventFacade, {
    /**
    Get a property from the event's data collection supplied at event creation.
    Returns one of the following, in priority order:
    1. value returned from a `_getter` defined for the property
    1. value of the property in the event's data collection, if present
    1. value of the property on the originating DOM event, if present
    1. value of the property on the event object itself

    @method get
    @param {String} name Data property name
    @return {Any} whatever is stored in the data property
    **/
    // TODO: node-event module to add _getter for target, currentTarget, and
    // relatedTarget and deal with target possibly being a text node
    get: function (name) {
        if (this._getter[name]) {
            return this._getter[name].call(this, name);
        } else if (name in this.data) {
            return this.data[name];
        } else {
            return (name in this._event) ? this._event[name] : this[name];
        }
    },

    /**
    Disables any default behavior of the event.

    @method preventDefault
    @chainable
    **/
    preventDefault: function () {
        this._prevented = true;

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
        if (!this._stopped) {
            this._stopped = 1;

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
        this._stopped = 2;

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
    }
});

DOMEvent = new Y.CustomEvent('@dom-event', {
    subscribe: function (target, args, phase) {
        var type    = args[0],
            capture = (phase === 'capture'),
            phase   = capture ? 'capture' : 'on',
            sub     = null,
            el, eventKey, subs, i, len;

        // Convert from arguments object to array
        args = toArray(args, 0, true);

        if (target === Y) {
            target = args.splice(2,1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el && el.nodeType) {
            eventKey = args[0] = Y.stamp(el) + ':' + type;

            sub = new this.Subscription(Y, args, phase, {
                domType: type
            });

            this.registerSub(el, sub);
        // TODO: el could be a DOM collection ala getElementsByTagName()
        } else if (isArray(el)) {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                subs.push(this.subscribe(el[i], args, phase));
            }

            // Return batch subscription
            sub = new Y.CustomEvent.Subscription(subs);
        }

        return sub;
    },

    registerSub: function (target, sub) {
        var type    = sub.details.domType,
            subs    = Y._yuievt.subs,
            capture = (sub.phase === 'capture'),
            phase   = capture ? 'capture' : 'on';

        subs = subs[sub.type] || (subs[sub.type] = {});

        subs = subs[phase] || (subs[phase] = []);

        subs.push(sub);

        // First subscription needs a DOM subscription
        if (subs.length === 1) {
            YUI.Env.add(target, type, Y.Event._handleEvent, capture);
        }
    },

    unsubscribe: function (target, args) {
        var type  = args[0],
            isSub = (type.type && type.callback),
            isY   = (target === Y),
            el, eventKey, capture, phase, i, len, subs;

        if (isSub) {
            return this._super.unsubscribe.apply(this, arguments);
        }

        if (target === Y) {
            target = args.splice(2, 1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el && el.nodeType) {
            eventKey = Y.stamp(el) + ':' + type;
            capture  = (args[2] === 'capture');
            phase    = capture ? 'capture' : 'on';
            subs     = Y._yuievt.subs;

            this._super.unsubscribe.call(this, Y,
                [eventKey, args[1], phase]);

            // No more subs, remove the DOM subscription
            if (!subs[eventKey] || !subs[eventKey][phase]) {
                YUI.Env.remove(el, type, Y.Event._handleEvent, capture);
            }
        } else if (isArray(el)) {
            for (i = 0, len = el.length; i < len; ++i) {
                this.unsubscribe(el[i], args);
            }
        }
    },

    fire: function (target, type, e, currentTarget) {
        var type     = e.type,
            eventKey = Y.stamp(currentTarget) + ':' + type,
            phase    = (e.eventPhase === 1) ? 'capture' : 'on',
            subs     = Y._yuievt.subs[eventKey],
            event, i, len, sub, ret;

        subs  = subs && subs[phase];

        // This shouldn't happen because the last detached sub should
        // trigger the DOM sub being removed, but just in case...
        if (!subs) {
            return;
        }

        event = new this.Event(type,
                    (e.target || e.srcElement), {
                        _event       : e,
                        currentTarget: currentTarget
                    });

        // To be set using event.get('currentTarget');
        currentTarget = null;

        for (i = 0, len = subs.length; i < len; ++i) {
            sub = subs[i];

            event.subscription = sub;

            if (sub.thisObj) {
                ret = sub.notify(event);
            } else {
                // Lazy evaluate the current target as the thisObj
                // for the subscription to avoid the function call and
                // potential getter cost to create a Node instance
                sub.thisObj = currentTarget ||
                        (currentTarget = event.get('currentTarget'));

                sub.notify(event);

                sub.thisObj = null;
            }

            event.subscription = null;

            // Boy I hate this "feature"
            if (ret === false) {
                event.halt();
            }

            if (event._stopped === 2) {
                break;
            }
        }
    },

    Event: DOMEventFacade
}, Y.CustomEvent.FacadeEvent);

for (i = 0, len = EVENT_NAMES.length; i < len; ++i) {
    DOM_EVENTS[EVENT_NAMES[i]] = DOMEvent;
}

// Y.Event is an EventTarget
Y.Event = {
    /**
    DOM and synthetic event collection for sharing between Y, Node, and
    NodeList.

    @property DOM_EVENTS
    @type {Object}
    **/
    DOM_EVENTS: DOM_EVENTS,

    /**
    The custom event definition (prototype) used to handle DOM events.
    Modifying this will alter the behavior of all DOM events.

    @property DOMEvent
    @type {CustomEvent}
    **/
    DOMEvent: DOMEvent,

    /**
    The event facade class used by DOMEvent (aka DOMEventFacade).

    @property EventFacade
    @type {Event.EventFacade}
    **/
    EventFacade: DOMEventFacade,

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
        // Default DOMEvent as base so Y.Event.publish('beforeunload')
        // is enough to whitelist a DOM event
        inheritsFrom || (inheritsFrom = Y.Event.DOMEvent);

        if (config || inheritsFrom !== Y.Event.DOMEvent) {
            Y.EventTarget._publish(Y.Event, Y.Event.DOM_EVENTS,
                type, config, inheritsFrom, smart);
        } else if (!Y.Event.DOM_EVENTS[type]) {
            Y.Event.DOM_EVENTS[type] = inheritsFrom;
        }
    },

    /**
    Tests if an event name is a DOM event.

    @method isEventSupported
    @param {String} type
    @return {Boolean}
    **/
    //Code by kangax, from 
    //http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
    // TODO: Remove? This is no longer needed.
    isEventSupported: Y.cached(function (type) {
        var el = Y.config.doc.createElement(eventTestTags[type] || 'div'),
            eventName   = 'on' + type;
            isSupported = (eventName in el);

        if (!isSupported) {
            el.setAttribute(eventName, 'return;');
            isSupported = typeof el[eventName] === 'function';
        }

        el = null;

      return isSupported;
    }),

    /**
    Resolves the input value to a DOM Element or array of DOM Elements.

    If unsuccessful, `null` is returned.

    If no target is passed, `Y.config.win` is returned.

    @method _resolveTarget
    @param {String|Node|NodeList|Element|Element[]}
    @return {Element|Element[]}
    @protected
    **/
    _resolveTarget: function (target) {
        if (!target) {
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

// Replace the events map for Y to include DOM events, allowing
// Y.Event.publish(...) to add to Y's collection via prototypal inheritance.
events = Y._yuievt.events;
Y._yuievt.events = Y.Object(Y.Event.DOM_EVENTS);

for (event in events) {
    // ignore hasOwnProperty in favor of duck typing CustomEvent or Router
    if (events[event].subscribe) {
        Y._yuievt.events[event] = events[event];
    }
}

}, '', { requires: [ 'eventx', 'selector' ] });
