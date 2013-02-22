YUI.add('eventx-node', function (Y) {
/**
Adds EventTarget support to Node and NodeList.

@module eventx
@submodule eventx-node
@for Node
**/
// Use Y.Event's base and default events for Node and NodeList
var baseEvent    = Y.Event.getEvent('@BASE'),
    defaultEvent = Y.Event.getEvent('@DEFAULT');

Y.augment(Y.Node, Y.EventTarget);
Y.EventTarget.configure(Y.Node, null, baseEvent, defaultEvent);

Y.augment(Y.NodeList, Y.EventTarget);
Y.EventTarget.configure(Y.NodeList, null, baseEvent, defaultEvent);
}, '', { requires: [ 'eventx-dom', 'node-base' ] });
