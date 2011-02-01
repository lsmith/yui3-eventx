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
    
function DOMEventFacade(type, e) {
    this._event = e;
    this.data   = {};
}
Y.extend(DOMEventFacade, EventFacade, {
    _getter: YObject(EventFacade.prototype._getter, {
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
