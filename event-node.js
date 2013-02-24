YUI.add('eventx-node', function (Y) {
/**
Adds EventTarget support to Node and NodeList.

@module eventx
@submodule eventx-node
@for Node
**/
// Use Y.Event's base and default events for Node and NodeList
var EventTarget  = Y.EventTarget,
    events       = Y.Object(Y.Event._yuievt.events),
    baseEvent    = events['@BASE'],
    defaultEvent = events['@DEFAULT'];

Y.augment(Y.Node, EventTarget);
EventTarget.configure(Y.Node, events, baseEvent, defaultEvent);

Y.augment(Y.NodeList, EventTarget);
EventTarget.configure(Y.NodeList, events, baseEvent, defaultEvent);

function getNode(name) {
    var node = this.data[name];

    // Allow setters to populate e.data[name] with a DOM element.
    // Allowing set(...) to store DOM elements helps delegation performance.
    if (!node || !(node instanceof Y.Node)) {
        node = (this.data[name] = Y.one(this._event[name]));
    }

    return node;
}

Y.mix(Y.Event.EventFacade.prototype._getter, {
    target: function (val) {
        var target = this.data.target;

        if (!target || !(target instanceof Y.Node)) {
            target = this._event.target;

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

Y.Node.DOM_EVENTS = {
    abort: 1,
    beforeunload: 1,
    blur: 1,
    change: 1,
    click: 1,
    close: 1,
    command: 1,
    contextmenu: 1,
    dblclick: 1,
    DOMMouseScroll: 1,
    drag: 1,
    dragstart: 1,
    dragenter: 1,
    dragover: 1,
    dragleave: 1,
    dragend: 1,
    drop: 1,
    error: 1,
    focus: 1,
    key: 1,
    keydown: 1,
    keypress: 1,
    keyup: 1,
    load: 1,
    message: 1,
    mousedown: 1,
    mouseenter: 1,
    mouseleave: 1,
    mousemove: 1,
    mousemultiwheel: 1,
    mouseout: 1,
    mouseover: 1,
    mouseup: 1,
    mousewheel: 1,
    orientationchange: 1,
    reset: 1,
    resize: 1,
    select: 1,
    selectstart: 1,
    submit: 1,
    scroll: 1,
    textInput: 1,
    unload: 1
};

}, '', { requires: [ 'eventx-dom', 'node-core' ] });
