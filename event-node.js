YUI.add('eventx-node', function (Y) {
/**
Adds EventTarget support to Node and NodeList.

@module eventx
@submodule eventx-node
@for Node
**/
// Use Y.Event's base and default events for Node and NodeList
var EventTarget  = Y.EventTarget,
    DEFAULT      = '@default',
    defaultEvent = Y._yuievt.events[DEFAULT];

// Manually replace the class events collection with a proto wrap of the
// Y.Event.DOM_EVENTS collection so added DOM events will be available, but
// events published on Y.Node won't pollute the shared DOM event collection.
Y.augment(Y.Node, EventTarget);
EventTarget.configure(Y.Node);
Y.Node.events = Y.Object(Y.Event.DOM_EVENTS);
Y.Node.events[DEFAULT] = defaultEvent;

// Manually replace the class events collection with a proto wrap of the
// Y.Event.DOM_EVENTS collection so added DOM events will be available, but
// events published on Y.NodeList won't pollute the shared DOM event collection.
// TODO: A separate proto wrap from Y.Node so custom events published on
// NodeList are specific to NodeList. Should they be shared?
Y.augment(Y.NodeList, EventTarget);
EventTarget.configure(Y.NodeList);
Y.NodeList.events = Y.Object(Y.Event.DOM_EVENTS);
Y.NodeList.events[DEFAULT] = defaultEvent;

Y.Node.prototype.purge = Y.NodeList.prototype.purge = function (recurse, type) {
    Y.Event.purgeElement(this, recurse, type);
};

Y.Node.prototype.detachAll = Y.NodeList.prototype.detachAll = function () {
    var types, i;
    // Not wrapped in the _yuievt test because the subscription may have come
    // from Y.on()
    Y.Event.purgeElement(this);

    if (this._yuievt) {
        types = Y.Object.keys(this._yuievt.subs);

        for (i = types.length - 1; i >= 0; --i) {
            this.detach(types[i]);
        }
    }
};

function getNode(name) {
    var node = this.data[name] || this._event[name];
    
    // Don't cache the Node instance in this.data because that makes for mixed
    // types, which can cause headaches. The performance is worse by running
    // Y.one() for every get(), but it can be mitigated by the calling code
    // capturing the value.
    return node && Y.one(node);
}

function setElement(name, val) {
    if (val) {
        if (val._node) {
            val = val._node;
        }

        while (val && val.nodeType === 3) {
            val = val.parentNode;
        }
    }

    this.data[name] = val;
}

Y.mix(Y.Event.EventFacade.prototype._getter, {
    target       : getNode,
    currentTarget: getNode,
    relatedTarget: getNode,
    container    : function () {
        var details   = this.subscription && this.subscription.details,
            container = this.data.container || (details && details.container);

        return container && Y.one(container);
    }
}, true);

Y.mix(Y.Event.EventFacade.prototype._setter, {
    target       : setElement,
    currentTarget: setElement,
    relatedTarget: setElement,
    container    : setElement
}, true);

}, '', { requires: [ 'eventx-dom', 'node-core' ] });
