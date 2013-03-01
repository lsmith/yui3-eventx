YUI.add('eventx-node-delegate', function (Y) {
/**
Adds delegate support to Node and NodeList.

@module eventx
@submodule eventx-node-delegate
@for Node
**/

// Node has already been augmented with EventTarget, but we have to re-augment
// to add the delegate method. If we augment with a whitelist of ['delegate']
// to add only that method, calling delegate() will trigger the constructor,
// but then calling any of the other EventTarget methods will trigger it again,
// which will wipe out any event subscriptions added directly to the Node.
Y.augment(Y.Node, Y.EventTarget, true);

// Override the getter for container to cache the Node instance in the data
// collection.
Y.Event.FacadeEvent.prototype._getter.container = function () {
    var container = this.data.container || this.details.container;

    if (container && !(container instanceof Y.Node)) {
        container = this.data.container = Y.one(container);
    }

    return container;
};

}, '', { requires: [ 'eventx-dom-delegate', 'eventx-node' ] });
