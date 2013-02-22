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
    };

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

// Y.Event is an EventTarget
Y.Event = Y.mix(new Y.EventTarget(), {

    /**
    Tests if an event name is a DOM event.

    @method isEventSupported
    @param {String} type
    @return {Boolean}
    **/
    //Code by kangax, from 
    //http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
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

        Y.Event.fire(e.type, e, this);
    },

    EventFacade: DOMEventFacade
}, true);

Y.Event.publish({
    // Base event is dynamic to allow for dynamic DOM subscriptions such as
    // `Y.Event.on('click:li.expandable', callback, '.tree')`
    '@BASE': new Y.CustomEvent('@BASE', {
        // TODO: simplified method implementations, no phases?
        // TODO: Is this safe for synthetic events to have DOMEventFacade as
        // this.Event? Maybe it should be a different facade.
        Event: DOMEventFacade
    }, Y.CustomEvent.DYNAMIC_BASE),

    // Default event subscribes to DOM events
    '@DEFAULT': {
        subscribe: function (target, phase, args) {
            var type       = args[0],
                capture    = (phase === 'capture'),
                sub        = null,
                isDOMEvent = Y.Node ?
                                Y.Node.DOM_EVENTS[type] :
                                Y.Event.isEventSupported(type),
                event = !isDOMEvent &&
                            this.getDynamicEvent(target, args, 'subscribe'),
                isYEvent, i, len, type, el, subs, eventKey, needsDOMSub;

            if (event) {
                return event.subscribe(target, phase, args);
            }
            
            if (!isDOMEvent) {
                // Custom event subscription
                return this._super.subscribe.apply(this, arguments);
            }

            // DOM event subscription
            // Convert from arguments object to array
            isYEvent = (target === Y.Event);
            args = toArray(args, 0, true);
            el = Y.Event._resolveTarget(isYEvent ? args[2] : target);
            phase = capture ? 'capture' : 'on';

            if (el && el.nodeType) {
                // Remove the target from args to allow thisObj and payload
                // args to slide into their proper indices
                if (target === Y.Event) {
                    args.splice(2, 1);
                }

                eventKey = args[0] = Y.stamp(el) + ':' + type;

                sub = new this.Subscription(Y.Event, args, phase);

                subs = Y.Event._yuievt.subs;

                if (!subs[eventKey]) {
                    needsDOMSub = true;
                    subs[eventKey] = {};
                }

                subs = subs[eventKey];

                if (!subs[phase]) {
                    needsDOMSub = true;
                    subs[phase] = [];
                }

                subs[phase].push(sub);

                if (needsDOMSub) {
                    YUI.Env.add(el, type, Y.Event._handleEvent, capture);
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

                    subs.push(this.subscribe(target, phase, args));
                }

                // Return batch subscription
                sub = new Y.CustomEvent.Subscription(subs);
            }

            return sub;
        },

        unsubscribe: function (target, args) {
            var type  = args[0],
                isSub = (type.type && type.callback),
                capture, isDOMEvent, event, i, len, el, eventKey, phase;

            if (isSub) {
                return this._super.unsubscribe(target, args);
            }

            capture = (args[2] === 'capture');
            // Avoid dynamic event routing for white listed DOM events
            isDOMEvent = Y.Node ?
                Y.Node.DOM_EVENTS[type] :
                Y.Event.isEventSupported(type);
            event = !isDOMEvent &&
                        this.getDynamicEvent(target, args, 'unsubscribe');

            if (event) {
                return event.unsubscribe(target, args);
            }

            if (!isDOMEvent) {
                return this._super.unsubscribe(target, args);
            }

            el = Y.Event._resolveTarget(args[2]);

            if (el && el.nodeType) {
                args[0] = eventKey = Y.stamp(el) + ':' + type;
                args[2] = capture ? 'capture' : 'on';

                this._super.unsubscribe(target, args);

                // No more subs, remove the DOM subscription
                if (!target._yuievt.subs[eventKey][phase].length) {
                    target._yuievt.subs[eventKey][phase] = null;

                    YUI.Env.remove(el, type, Y.Event._handleEvent, capture);
                }
            } else if (isArray(el)) {
                for (i = 0, len = el.length; i < len; ++i) {
                    args[2] = el[i];
                    this.unsubscribe(target, args);
                }
            }
        },

        fire: function (target, type, e, currentTarget) {
            var subs = target._yuievt.subs[type],
                eventKey, phase, event, i, len, sub, ret;

            // custom event subscriptions
            if (subs) {
                return this._super.fire.apply(this, arguments);
            }

            eventKey = Y.stamp(currentTarget) + ':' + type;
            phase    = (e.eventPhase === 1) ? 'capture' : 'on';
            subs     = Y.Event._yuievt.subs[eventKey];

            if (subs && subs[phase] && subs[phase].length) {
                event = new Y.Event.EventFacade(type,
                            (e.target || e.srcElement), {
                                _event       : e,
                                currentTarget: currentTarget
                            });

                subs = subs[phase];
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
            }
        }
    }
});

}, '0.0.1', { requires: [ 'eventx', 'selector' ] });
