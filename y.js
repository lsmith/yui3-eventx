/**
Makes Y an EventTarget with support for dynamic events. Adds a dynamic @dom
event to handle routing `Y.on('click', callback, selector, ...)` to the DOM
event subscription system.

@module event-custom
@submodule event-y
@for YUI
**/

// Add the EventTarget API to Y
Y.mix(Y, EventTarget.prototype, true);
EventTarget.call(Y);

Y.EventTarget.configure(Y, {
        /**
        Dynamic event to route DOM subscriptions to `Y.Event.on()`.

        Matches `Y.on(type, callback, selector)` when:
        * selector is a string OR
        * selector is a DOM element
        * type is in the Y.Node.NODE_EVENTS whitelist AND
            * selector is falsy OR
            * selector is a Node or NodeList

        @event @dom
        **/
        '@dom': {
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
        }
    }, 
    Y.CustomEvent.DYNAMIC_BASE,
    Y.CustomEvent.DYNAMIC_DEFAULT);
