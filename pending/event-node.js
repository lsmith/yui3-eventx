YUI.add('eventx-node', function (Y) {

var YObject   = Y.Object,
    proto     = YObject,
    YEventDOM = Y.EventX.DOM,
    Node      = Y.Node,
    NodeList  = Y.NodeList,
    DOMEventFacade = Y.DOMEventFacade,

    toArray   = Y.Array,
    isString  = Y.Lang.isString,
    isArray   = Y.Lang.isArray,
    scrub     = Node.scrubVal;
    DOMEventFacade_get = DOMEventFacade.prototype.get,


// replace DOM subscription behavior to also support Nodes
YEventDOM._events.publish({
    type: '_DEFAULT',

    domSubscribe: function (host, sub) {
        var args    = sub.payload || [],
            thisObj = sub.thisObj,
            // TODO: too much intelligence about TYPE_PATTERN
            type  = (sub.category) ? sub.category + '|' + sub.type : sub.type,
            nodes = (thisObj instanceof NodeList) ? thisObj : Y.all(thisObj);

        if (!nodes.size() && isString(thisObj)) {
            args.unshift(type, sub.callback, thisObj);
            Y.on('available', function () {
                Y.on.apply(Y, args);
            }, thisObj);
        } else {
            args.unshift(nodes._nodes, type, sub.callback);

            YEventDOM.on.apply(YEventDOM, args);
        }

        // return true to route the event without local subscription
        return true;
    }
});

function NodeEventFacade(type, e) {
    this._event = e;
    this.data   = {};
}
Y.extend(NodeEventFacade, DOMEventFacade, {
    _getter: proto(DOMEventFacade.prototype._getter, {
        target: function () {
            if (!this._target) {
                var target = this._event.target;
                while (target && target.nodeType === 3) {
                    target = target.parentNode;
                }
                this._target = Y.one(target);
            }
            return this._target;
        }
    }),

    get: function (name) {
        return scrub(DOMEventFacade_get.call(this, name));
    }
});
YEventDOM._events.publish({
    type: '_DEFAULT',
    Event: NodeEventFacade
});


Y.mix(Node.prototype, {
    on: function () {
        var args = toArray(arguments, 0, true);
        args.unshift(this._node);
        YEventDOM.on.apply(YEventDOM, args);
        
        return this;
    },

    detach: function (type, callback) {
        YEventDOM.detach(this._node, type, callback);

        return this;
    }
});

// Override raw DOM event subscription to work with Nodes
Y._yuievt.subOverrides.domSubscribe = function (host, sub) {
    var thisObj = sub.thisObj;
    if (thisObj) {
        if (isString(thisObj)) {
            return true;
        } else {
            if (isArray(thisObj) && thisObj.length) {
                thisObj = thisObj[0] || {};
            }
            return (thisObj.nodeType ||
                    thisObj instanceof Node ||
                    thisObj instanceof NodeList);
        }
    }
    
    return false;
};
Y._yuievt.detachOverrides.domDetach = function () {
    // TODO
};

}, '0.0.1', { requires: ['eventx-core', 'eventx-dom'], optional: ['eventx-available'] });
