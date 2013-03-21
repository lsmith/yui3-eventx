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

Y.mix(Y.Event.EventFacade.prototype._getter, {
    target: function () {
        var target = this.data.target;

        if (target && !(target instanceof Y.Node)) {
            while (target.nodeType === 3) {
                target = target.parentNode;
            }

            target = this.data.target = Y.one(target);
        }

        return target;
    },

    currentTarget: getNode,
    relatedTarget: getNode,
    container: function () {
        var container = this.data.container ||
                        (this.subscription &&
                         this.subscription.details &&
                         this.subscription.details.container);

        return container && Y.one(container);
    }
}, true);

}, '', { requires: [ 'eventx-dom', 'node-core' ] });
