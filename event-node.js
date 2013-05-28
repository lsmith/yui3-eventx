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

if (Object.defineProperties) {
    Object.defineProperties(Y.Event.EventFacade.prototype, {
        target: {
            // Identical to core getter, except it returns a Node
            get: function () {
                var el = this._event.target;

                // Lazily resolve text node targets
                while (el.nodeType === 3) {
                    el = el.parentNode;
                }

                return Y.one(el);
            }
            // setter defined in event-dom, demotes to regular property
        },
        // Demoted on get because there are a few issues to balance:
        // * IE8 and prior don't pass e.currentTarget, so it has to be passed
        //   into the handling function from the subscription.
        // * thisObjFn returns e.currentTarget for default callback `this`,
        //   making the default behavior at least one call to Y.one(),
        //   regardless of whether it will be used.
        // * Since thisObjFn gets e.currentTarget once, multiple `this` refs
        //   won't incur getter cost, but event a single e.currentTarget ref
        //   in the callback would mean two getter hits.
        // * configured `this` and never referencing e.currentTarget can avoid
        //   creating a Node.
        // Summary: The cost of reconfiguration quickly becomes less than getter
        // overhead. It mostly impacts the default case where either `this` is
        // defaulted but not used, or `this` is configured and e.currentTarget
        // is referred to only once. This is slightly more than the non-eventx
        // implementation is doing for currentTarget, but can at least avoid
        // node creation in the case where `this` is configured and
        // e.currentTarget is not referenced in the callback.
        currentTarget: {
            get: function () {
                var val = Y.one(this._currentTarget);

                Object.defineProperty(this, 'currentTarget', {
                    value: val,
                    configurable: true,
                    writable: true
                });

                return val;
            },
            set: function (val) {
                // TODO: may not be necessary
                this._currentTarget = val;
            }
        },
        relatedTarget: {
            get: function () {
                return Y.one(this._event.relatedTarget);
            }
        },
        container    : {
            get: function () {
                var el = this.subscription &&
                         this.subscription.details &&
                         this.subscription.details.container;

                return el && Y.one(el);
            }
        }
    });
}

}, '', { requires: [ 'eventx-dom', 'node-core' ] });
