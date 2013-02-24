YUI.add('eventx-node-delegate', function (Y) {
/**
Adds delegate support to Node and NodeList.

@module eventx
@submodule eventx-node-delegate
@for Node
**/
var EventFacadeProto = Y.Event.EventFacade.prototype;

// Node has already been augmented with EventTarget, so we only need to
// add the delegate method to the 
Y.augment(Y.Node, Y.EventTarget, true, ['delegate']);

// Use the same getter for container as for currentTarget, which will cache a
// Node instance in e.data.container if it's not found or the value in e.data
// isn't currently a Node.
EventFacadeProto._getter.container = EventFacadeProto._getter.currentTarget;

}, '', { requires: [ 'eventx-dom-delegate', 'event-node' ] });
