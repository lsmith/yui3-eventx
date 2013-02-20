YUI.add('eventx-dom', function (Y) {

var EventTarget = Y.EventTarget,
    EventFacade = Y.EventFacade,

    isString  = Y.Lang.isString,
    isArray   = Y.Lang.isArray,
    toArray   = Y.Array,
    YObject   = Y.Object,
    getByPath = YObject.getValue,

    bindings  = {},
    getEl, setEl,
    YEventDOM,
    eventMgr;
    
function Subscription() {
}

Subscription.prototype = {
};

function DOMSubscription(target, type, capture) {
}

DOMSubscription.prototype = {
};

function DOMEventFacade() {
}

DOMEventFacade.prototype = {
};

// Y.Event gets the EventTarget interface, but...
Y.Event = {
    _subs: {},

    _events: {
        // Base event is dynamic to allow for dynamic DOM subscriptions such as
        // `Y.Event.on('click:li.expandable', callback, '.tree')`
        '@BASE': new Y.CustomEvent('@BASE', {
            //TODO: simplified method implementations, no phases
            Event: DOMEventFacade,
            Subscription: Subscription
        }, Y.CustomEvent.DYNAMIC_BASE,

        // Default event
        '@DEFAULT': new Y.CustomEvent('@DEFAULT', {
            subscribe: function (target, phase, args) {
                // Avoid dynamic event routing for white listed DOM events
                return (Y.Node && Y.Node.NODE_EVENTS[args[0]]) ?
                    Y.Event.attach(args, (phase === 'capture')) :
                    this._super.subscribe.apply(this, arguments);
            },

            unsubscribe: function (target, args) {
                // TODO
            },

            // TODO: Remove these if they're not appropriate for the default event
            Event: DOMEventFacade,
            Subscription: Subscription
        }, Y.CustomEvent.DYNAMIC_DEFAULT));
    },

    /**
    Publish a synthetic DOM event to add new events encapsulating common
    subscription patterns or normalize browser inconsistencies. These events
    can be subscribed to from Y.Nodes or Y.NodeLists, or using `Y.Event.on()`.

    @method publish
    @param {String|Object} type The name of the event to publish or a map of
                                configs
    @param {Object} [config] Behavioral extensions and overrides for this event
    @param {CustomEvent} [inheritsFrom] Instead of deriving from the class's
                            default event
    **/
    publish: function (type, config, inheritsFrom) {
        Y.EventTarget._publish(Y.Event, Y.Event._events,
            type, config, inheritsFrom);
    },

    /**
    Subscribe to a DOM event in the bubble phase. See `Y.Event._on()` if
    you want to subscribe to the capture phase.
    
    _type_ may be a string identifying the event or an object map of types to
    callback functions.

    Custom/Synthetic events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    Y.Event.on(type, callback, target, thisObj, extraArg, ...exrtraArgN);
    ```

    _target_ is optional, but if provided may be a DOM element, array of DOM
    elements, a Y.Node or Y.NodeList, or selector string. If not provided,
    `Y.config.win` is used.

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is _target_. Arguments beyond _thisObj_ will
    be passed to the callback after the event object.
    
    If no event published for this class or instance matches the type
    string exactly, the default event behavior will be used.

    @method on
    @param {String} type event type to subcribe to
    @param {Any*} sigArgs see above note on default signature
    @chainable
    **/
    on: function (type) {
        var event = Y.Event._events[type];

        if (!event) {
            if (typeof type === STRING) {
                event = Y.Event._events[DEFAULT];
            } else {
                // Defer object/array syntax handling to subscribe()
                return this.subscribe(toArray(arguments, 0, true));
            }
        }

        event.subscribe(this, args);

        return this;
    },

    /**
    Subscribe to a DOM event. This method allows capture phase subscriptions.
    
    _type_ may be a string identifying the event or an object map of types to
    callback functions.

    Custom/Synthetic events may override the default subscription signature, but
    by default the subscription signature will look like this:

    ```
    Y.Event._on([type, callback, target, thisObj, extraArg, ...exrtraArgN]);
    ```

    _target_ is optional, but if provided may be a DOM element, array of DOM
    elements, a Y.Node or Y.NodeList, or selector string. If not provided,
    `Y.config.win` is used.

    _thisObj_ is optional, and sets the _callback_'s `this` object. The default
    `this` object in the callback is _target_. Arguments beyond _thisObj_ will
    be passed to the callback after the event object.
    
    If no event published for this class or instance matches the type
    string exactly, the default event behavior will be used.
    
    @method _on
    @param {Any*} args see above note on default signature
    @param {Boolean} capture Make the subscription in capture phase if possible
    @protected
    **/
    _on: function (args, capture) {
        var type  = args[0],
            event = Y.Event._events[type],
            i, len;

        if (!event) {
            if (typeof type === STRING) {
                event = Y.Event._events[DEFAULT];
            } else if (isObject(type)) {
                if (isArray(type)) {
                    for (i = 0, len = type.length; i < len; ++i) {
                        args[0] = type[i];
                        Y.Event._on(args, capture);
                    }
                } else {
                    for (event in type) {
                        if (type.hasOwnProperty(event)) {
                            args[0] = event;
                            // Weak point, assumes signature includes callback
                            // as third arg for the event (sorta).
                            args[1] = type[event];
                            Y.Event._on(args);
                        }
                    }
                }

                return this;
            }
        }

        event.subscribe(this, args, capture);

        return this;
    },

    /**
    Create a DOM event subscription directly, bypassing any custom or synthetic
    event logic that may be configured for an event name.

    _args_ is expected to be an array containing:
    * type (string) - name of the DOM event
    * callback (function) - subscriber
    * target (Element|Element[]|Node|NodeList|String) - optional, what to
        subscribe to
    * thisObj (object) - overrides `this` in the callback
    * ...argN - any additional arguments to pass to the callback after the
        event object.

    @method attach
    @param {Array} 
    **/
    attach: function (args, capture) {
        var target = args[2],
            type, callback, i, len, subs, args, eventKey;

        if (!target) {
            target = Y.config.win;
        } else if (typeof target === 'string') {
            target = Y.Selector.queryAll(target);

            if (target.length === 1) {
                target = target[0];
            } else if (target.length === 0) {
                return null;
            }
        } else if (Y.Node) {
            if (target instanceof Y.Node) {
                target = target._node;
            } else if (target instanceof Y.NodeList) {
                target = target._nodes;
            }
        }

        // At last, we have a DOM node. Get on with the subscribing, already!
        if (target.nodeType) {
            subs     = Y.Event._subs;
            type     = args[0];
            eventKey = Y.stamp(target) + ':' + type;

            if (capture) {
                eventKey += ':capture';
            }

            if (!subs[eventKey]) {
                subs[eventKey] =
                    new Y.Event.DOMSubscription(target, type, capture);
            }

            return subs[eventKey].subscribe.apply(subs[eventKey], args);
        } else if (isArray(target)) {
            type = args[0];
            subs = [];
            for (i = 0, len = target.length, i < len; ++i) {
                args[2] = target[i];
                subs.push(Y.Event.attach(args, capture));
            }

            return new Y.Event.Subscription(args[0], null, subs);
        }

        return null;
    },

    detach: function (type, callback) {
        // TODO
    },

    Subscription: Subscription,

    DOMSubscription: DOMSubscription
};

}, true);




function DOMEventFacade(type, target, payload) {
    this._event = e;
    this.data   = {};
}
Y.extend(DOMEventFacade, EventFacade, {
    _getter: {
        target: function () {
            if (!this._target) {
                var target = this._event.target;
                while (target && target.nodeType === 3) {
                    target = target.parentNode;
                }
                this._target = target;
            }
            return this._target;
        }
    }),

    _setter: {},

    get: function (name) {
        var val;
        if (this._getter[name]) {
            val = this._getter[name].call(this);
        } else {
            // Avoid read-only errors by overriding values in data and reading
            // values from data, then fall back to _event
            val = (name in this.data) ? this.data[name] : this._event[name];
        }

        return val;
    }
});
Y.DOMEventFacade = DOMEventFacade;

// Manage map of HTML elements to avoid circular ref memory leak in IE
(function () {
    var elements = {};

    getEl = function (yuid) {
        return elements[yuid];
    };
    setEl = function (el) {
        var yuid = Y.stamp(el);
        elements[yuid] = el;

        return yuid;
    };
})();

eventMgr = new EventTarget({
    _DEFAULT: {
        processArgs: function (args) {
            args[3] = setEl(args[3]);
        },

        generateSub: function (host, type, category, yuid, callback, thisObj) {
            var sub = this.constructor.superclass
                        .generateSub.apply(this, arguments);

            thisObj = sub.thisObj;

            sub.thisObj = (thisObj && thisObj.nodeType) ?
                                setEl(thisObj) : (thisObj || yuid);

            return sub;
        },

        on: function (host, sub) {
            var abort = false,
                type  = sub.type,
                yuid  = sub.phase,
                bindingId = type + '>' + yuid,
                event;

            if (this.fireOnce) {
                event = getByPath(YEventDOM._fired, [type, yuid]);

                if (event) {
                    this.registerSub(host, sub);
                    this.fire(host, type, yuid, event);
                    abort = true;
                }
            } else {
                if (!bindings[bindingId]) {
                    bindings[bindingId] =
                        YEventDOM.listen(yuid, type, function (e) {
                            eventMgr.fire(type, yuid, e);
                        });
                }
            }

            return abort;
        },

        fire: function (host, type, yuid, e) {
            var subs  = this.getSubs(host, type, null, yuid),
                event = this.generateEvent(host, type, e),
                args  = [event],
                i, len, sub, thisObj;

            for (i = 0, len = subs.length; i < len; ++i) {
                sub = subs[i];
                
                if (event._stop < 2) {
                    thisObj = (isString(sub.thisObj)) ?
                                    getEl(sub.thisObj) : sub.thisObj;

                    // Skip notification if thisObj refers to a node that
                    // doesn't exist any more
                    // TODO: test this
                    if (thisObj) {
                        event.currentTarget = getEl(sub.phase);

                        if (sub.payload) {
                            args = args.concat(sub.payload);
                        }

                        event.subscription = sub;

                        sub.callback.apply(thisObj, args);
                    }
                }

                if (this.fireOnce) {
                    sub.detach();
                }
            }

            if (event._stop) {
                // TODO: what's the proper thisObj? and proper fallback thisObj?
                this.stoppedFn.call(thisObj || host, event);
            }

            if (event._prevent && this.preventable) {
                // TODO: what's the proper thisObj? and proper fallback thisObj?
                this.preventedFn.call(thisObj || host, event);
            }

            if (this.fireOnce) {
                pushByPath(YEventDOM._fired, [type, yuid], event);
            }
        },

        generateEvent: function (host, type, e) {
            return new this.Event(type, e);
        },

        Event: DOMEventFacade,

        detach: function (host, sub) {
            var subs = getByPath(host._yuievt.subs, [sub.type, sub.phase]),
                type, yuid, bindingId, domBinding;

            // detach is called before the subscription is unregistered, so
            // check that the length is 1
            if (subs && subs.length === 1) {
                type = sub.type;
                yuid = sub.phase;
                bindingId = type + '>' + yuid;

                domBinding = bindings[bindingId];
                if (domBinding) {
                    YEventDOM.unlisten(yuid, type, domBinding);
                    delete bindings[bindingId];
                }
            }
        }
    }
}),

// TODO: This should probably just be Y.DOM augmentation
YEventDOM = Y.namespace("EventX").DOM = {
    listen: function (yuid, type, callback, phase) {
        getEl(yuid).addEventListener(type, callback, !!phase);
        return callback;
    },

    unlisten: function (yuid, type, callback, phase) {
        var el = getEl(yuid);
        el.removeEventListener(type, callback, !!phase);
        return callback;
    },

    stop   : function (e) { e.stopPropagation(); },
    prevent: function (e) { e.preventDefault(); },

    _events: eventMgr,

    _bindings: bindings,

    _getEl: getEl,
    _setEl: setEl,

    // static method uses a different signature, with first parameter being
    // the target element.
    on: function (el, type, callback, thisObj) {
        if (el && type) {
            var args = toArray(arguments, 0, true),
                i, len;

            args[0] = type; // params reversed for more natural API
            args[1] = el;

            if (el.nodeType) {
                eventMgr._subscribe(args);
            } else if (isArray(el)) {
                args.splice(0,2);
                for (i = 0, len = el.length; i < len; ++i) {
                    eventMgr._subscribe([type, el[i]].concat(args));
                }
            }
        }

        return YEventDOM;
    },

    detach: function (el, type, callback) {
        if (el) {
            if (el.detach) {
                el.detach();
            } else if (type) {
                if (el.nodeType) {
                    eventMgr.detach(type, Y.stamp(el), callback);
                } else if (isArray(el)) {
                    for (var i = 0, len = el.length; i < len; ++i) {
                        eventMgr.detach(type, Y.stamp(el[i]), callback);
                    }
                }
            } else {
                YEventDOM.detachAll(el);
            }
        }

        return YEventDOM;
    },

    detachAll: function (el) {
        var types, subs, type, i, yuid;

        if (el) {
            yuid = Y.stamp(el);

            types = eventMgr._yuievt.subs
            for (type in types) {
                if (types[type][yuid]) {
                    subs = types[type][yuid];
                    for (i = subs.length - 1; i >= 0; --i) {
                        subs[i].detach();
                    }
                }
            }
        }

        return YEventDOM;
    }
};

// DOM API has no notion of phases.
YEventDOM.after = YEventDOM.subscribe = YEventDOM.on;


// Add DOM event subscription to Y.on
Y._yuievt.subOverrides.domSubscribe = function (host, sub) {
    var thisObj = sub.thisObj;
    if (thisObj) {
        return thisObj.nodeType || isString(thisObj) ||
            (isArray(thisObj) && thisObj.length && thisObj[0].nodeType);
    }

    return false;
};

Y._yuievt.detachOverrides.domDetach = function () {
    // TODO
};

Y.publish({
    type: '_DEFAULT',

    domSubscribe: function (host, sub, type, category, _, callback, thisObj) {
        var args = toArray(arguments, 5, true),
            els;

        // TODO: too much intelligence about TYPE_PATTERN
        type = (sub.category) ? sub.category + '|' + sub.type : sub.type;
        if (isString(thisObj)) {
            els = (Y.Selector) ?
                        Y.Selector.query(thisObj) :
                        [Y.DOM.byId(thisObj)];

            if (!els.length) {
                args.unshift(type);
                Y.on('available', function () {
                    Y.on.apply(Y, args);
                }, thisObj);
                return true;
            }
        } else {
            els = toArray(thisObj);
        }

        args.unshift(els, type);

        YEventDOM.on.apply(YEventDOM, args);

        // return true to route the event without local subscription
        return true;
    },

    domDetach: function () {
        // TODO
    }
});

}, '0.0.1', { requires: [ 'eventx-core' ], optional: [ 'eventx-available' ] });
