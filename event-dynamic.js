YUI.add('eventx-dynamic', function (Y) {
/**
Adds Y.CustomEvent.DYNAMIC_BASE and DYNAMIC_DEFAULT to be used as base and
default events for classes that want support for publishing dynamic events.

```
Y.EventTarget.configure(MyClass, {
        '@foo': {
            test: function (target, args) { ... },
            ...
        },
        ...
    },
    Y.CustomEvent.DYNAMIC_BASE
    Y.CustomEvent.DYNAMIC_DEFAULT
);
```

Dynamic events are not bound to a specific event name, but use a `test()`
method to determine if they can appropriately handle a subscription. Two
examples of dynamic events are category events and routing events.

Category events can be used to handle events whose names match a convention,
such as 'nameChange' or 'click:li.expandable'.

Routing events can be used to handle a particular subscription signature,
directing subscriptions to a different subscription mechanism.

By convention, dynamic events should be named starting with an @ symbol, and
should not be explicitly fired. Instead, they are used to create subscriptions
to other events, possibly publishing them en route.

@module event-custom
@submodule event-dynamic
@for CustomEvent
**/
var arrayIndex = Y.Array.indexOf;

/**
A base event that includes support for registering dynamic events if they are
published with a `config.test(target, args)` method or `config.pattern`
regex to match against the event type string.

@property DYNAMIC_BASE
@type {CustomEvent}
@static
**/
Y.CustomEvent.DYNAMIC_BASE = new Y.CustomEvent('@BASE', {
    publish: function (target) {
        var events, defaultEvent;

        if (this.pattern) {
            this.test = function (target, args) {
                return this.pattern.test(args[0]);
            };
        }

        if (this.test) {
            events = typeof target === 'function' ?
                        target.events :
                        target._yuievt.events;
            defaultEvent = events['@DEFAULT'];

            if (!defaultEvent.dynamicEvents) {
                defaultEvent.dynamicEvents = [];
            }

            if (arrayIndex(defaultEvent.dynamicEvents, this) === -1) {
                defaultEvent.dynamicEvents.push(this);
            }
        }
    }
});

/**
A default event that first looks for published dynamic events to handle
subscriptions before handing control over to the base event subscription logic.

@property DEFAULT_EVENT
@type {CustomEvent}
**/
Y.CustomEvent.DYNAMIC_DEFAULT = new Y.CustomEvent('@DEFAULT', {
    subscribe: function (target, phase, args) {
        var events = this.dynamicEvents,
            event, i, len;

        if (events) {
            for (i = 0, len = events.length; i < len; ++i) {
                if (events[i].test(target, args)) {
                    return events[i].subscribe(target, phase, args);
                }
            }
        }

        // No dynamic event, defer to the base event subscription logic
        return this._super.subscribe.apply(this, arguments);
    }
});

}, '', { requires: [ 'eventx' ] });
