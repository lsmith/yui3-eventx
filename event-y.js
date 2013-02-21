YUI.add('eventx-y', function (Y) {
/**
Makes Y an EventTarget with support for dynamic events. Adds a dynamic @dom
event to handle routing `Y.on('click', callback, selector, ...)` to the DOM
event subscription system.

@module event-custom
@submodule event-y
@for YUI
**/

// Add the EventTarget API to Y
Y.mix(Y, Y.EventTarget.prototype, true);
Y.EventTarget.call(Y);

Y.EventTarget.configure(Y, null,
    Y.CustomEvent.DYNAMIC_BASE,
    Y.CustomEvent.DYNAMIC_DEFAULT);

}, '', { requires: [ 'eventx-dynamic' ] });
