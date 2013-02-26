YUI.add('eventx-node', function (Y) {
/**
Adds EventTarget support to Node and NodeList.

@module eventx
@submodule eventx-node
@for Node
**/
// Use Y.Event's base and default events for Node and NodeList
var EventTarget  = Y.EventTarget,
    events       = Y._yuievt.events,
    baseEvent    = events['@BASE'],
    defaultEvent = events['@DEFAULT'];

Y.augment(Y.Node, EventTarget);
EventTarget.configure(Y.Node, null, baseEvent, defaultEvent);

Y.augment(Y.NodeList, EventTarget);
EventTarget.configure(Y.NodeList, null, baseEvent, defaultEvent);

function getNode(name) {
    // Allow setters to populate e.data[name] with a DOM element.
    // Allowing set(...) to store DOM elements helps delegation performance.
    var node = this.data[name] || this._event[name];
    
    if (node && !(node instanceof Y.Node)) {
        node = this.data[name] = Y.one(node);
    }

    return node;
}

Y.mix(Y.Event.EventFacade.prototype._getter, {
    target: function (val) {
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
    relatedTarget: getNode
    // TODO: keyCode, charCode, etc
}, true);

}, '', { requires: [ 'eventx-dom', 'node-core' ] });
