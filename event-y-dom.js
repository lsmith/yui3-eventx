YUI.add('eventx-y-dom', function (Y) {
/**
Adds support for subscribing to DOM events from
`Y.on(type, callback, targetOrSelector, thisOverride, ...args)`.

Publishes a dynamic event on Y that will inspect the signature for selector
strings, HTML Elements, a Node, or a NodeList passed as the third argument
(normally the `thisObj` override). If the 'node' module is loaded, it checks
if the subscribed event is in the `Node.NODE_EVENTS` whitelist.

@module event
@submodule event-y-dom
@for YUI
**/

/**
Dynamic event to route DOM subscriptions to `Y.Event.on()`.

Matches `Y.on(type, callback, selector)` when:
* _selector_ is a string OR
* _selector_ is a DOM element
* type is in the Y.Node.NODE_EVENTS whitelist AND
    * _selector_ is falsy (the `Y.config.win` object is used) OR
    * _selector_ is a Node or NodeList

The `this` override argument and additional subscription binding arguments are
still supported and follow the _selector_ argument.

Since this is a dynamic event, it is not for direct subscription.

@event @dom
**/
Y.publish('@dom', {
    test: function (target, args) {
        var selector = args[2],
            match    = typeof selector === 'string' ||
                       (selector && selector.nodeType);

        if (!match && Y.Node) {
            match = Y.Node.NODE_EVENTS[args[0]] &&
                    (!selector ||
                        selector instanceof Y.Node ||
                        selector instanceof Y.NodeList);
        }

        return match;
    },

    subscribe: function (target, phase, args) {
        // Route dom event subscriptions to Y.Event.
        return Y.Event.on.apply(Y.Event, args);
    }
});

}, '', { requires: [ 'eventx', 'eventx-dom' ] });
