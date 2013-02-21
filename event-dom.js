YUI.add('eventx-dom', function (Y) {

var isArray = Y.Lang.isArray,
    toArray = Y.Array,
    push    = Array.prototype.push;

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
            return this._getter[name](name);
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
        this._event.preventDefault();
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
            this._event.stopPropagation();
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
        this._event.stopPropagation();

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
        this._event.preventDefault();
        this._event.stopPropagation();

        return this;
    }
});

// Y.Event is an EventTarget
Y.Event = Y.mix(new Y.EventTarget(), {

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

Y.EventTarget.configure(Y.Event, null,
    // Base event is dynamic to allow for dynamic DOM subscriptions such as
    // `Y.Event.on('click:li.expandable', callback, '.tree')`
    new Y.CustomEvent('@BASE', {
        // TODO: simplified method implementations, no phases?
        // TODO: Is this safe for synthetic events to have DOMEventFacade as
        // this.Event? Maybe it should be a different facade.
        Event: DOMEventFacade
    }, Y.CustomEvent.DYNAMIC_BASE),

    // Default event routes to Y.Event.attach for NODE_EVENTS and if there
    // isn't a dynamic event to handle the subscription
    {
        subscribe: function (_, phase, args) {
            var events     = this.dynamicEvents,
                // Avoid dynamic event routing for white listed DOM events
                type       = args[0],
                isDOMEvent = (Y.Node && Y.Node.NODE_EVENTS[type]),
                capture    = (phase === 'capture'),
                sub        = null,
                i, len, type, target, subs, eventKey, needsDOMSub;

            if (!isDOMEvent && events) {
                for (i = 0, len = events.length; i < len; ++i) {
                    if (events[i].test(target, args)) {
                        return events[i].subscribe(target, phase, args);
                    }
                }
            }

            // Convert from arguments object to array
            args   = toArray(args, 0, true);
            target = Y.Event._resolveTarget(args[2]);
            phase  = capture ? 'capture' : 'on';

            if (target && target.nodeType) {
                // Remove the target from args to allow thisObj and payload
                // args to slide into their proper indices
                args.splice(2, 1);

                eventKey = args[0] = Y.stamp(target) + ':' + type;

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
                    YUI.Env.add(target, type, Y.Event._handleEvent, capture);
                }
            } else if (isArray(target)) {
                subs = [];
                for (i = 0, len = target.length; i < len; ++i) {
                    args[2] = target[i];
                    subs.push(this.subscribe(Y.Event, phase, args));
                }
                // TODO return group sub
            }

            return sub;
        },

        unsubscribe: function (_, args) {
            var events     = this.dynamicEvents,
                // Avoid dynamic event routing for white listed DOM events
                isDOMEvent = (Y.Node && Y.Node.NODE_EVENTS[args[0]]),
                isSub      = (args[0].type && args[0].callback),
                capture    = (args[2] === 'capture'),
                i, len, target, phase;

            if (!isSub && !isDOMEvent && events) {
                for (i = 0, len = events.length; i < len; ++i) {
                    if (events[i].test(target, args)) {
                        return events[i].unsubscribe(Y.Event, args);
                    }
                }
            }

            // No dynamic event and not passed a Subscription instance to
            // detach
            if (!isSub) {
                target   = Y.Event._resolveTarget(args[2]);
                if (target && target.nodeType) {
                    args[0] = Y.stamp(target) + ':' + args[0];
                    args[2] = capture ? 'capture' : 'on';
                } else if (isArray(target)) {
                    for (i = 0, len = target.length; i < len; ++i) {
                        args[2] = target[i];
                        this.unsubscribe(Y.Event, args);
                    }

                    return;
                }
            }

            this._super.unsubscribe(Y.Event, args);
            // TODO: detach DOM subscriber when last subscriber is removed
        },

        fire: function (_, type, e, currentTarget) {
            var eventKey = Y.stamp(currentTarget) + ':' + type,
                phase    = (e.eventPhase === 1) ? 'capture' : 'on',
                subs     = Y.Event._yuievt.subs[eventKey],
                event, i, len, sub, ret;

            if (subs && subs[phase] && subs[phase].length) {
                event = new this.Event(type, (e.target || e.srcElement), {
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
        },

        Event: DOMEventFacade
    });

}, '0.0.1', { requires: [ 'eventx', 'selector' ] });
