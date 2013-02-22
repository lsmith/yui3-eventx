YUI.add('eventx-delegate', function (Y) {

var EventTarget = Y.EventTarget,
    CustomEvent = Y.CustomEvent,
    toArray     = Y.Array,
    isFunction  = Y.Lang.isFunction,
    initialize  = 

// No need to proto-wrap the defaultEvent because it is just a routing def
Y.mix(CustomEvent.prototype, {
    DELEGATE_PATTERN: /(.+):([^:]+)/,

    delegate: function (host, type, filter, callback, thisObj) {
        var args     = toArray(arguments, 0, true),
            filterFn = (isFunction(filter)) ?
                        filter : this.compileFilter(filter),
            sub;
            
        args.splice(2, 1, null, "before");
        sub = this.generateSub.apply(this, args);
        
        // TODO: This probably doesn't handle extra args or non-facade events
        function delegateDispatcher(e, sub) {
            if (filterFn(e, sub)) {
                e.set('container', sub.host);
                e.set('currentTarget', e.get('target'));

                sub.notify(e);
            }
        }

        host._subscribe([type, "before", delegateDispatcher, null, sub]);
    },

    compileFilter: Y.cached(function (filter) {
        return function (e) {
            var clz = e.get('target').constructor;
            
            do {
                if (clz.NAME === filter) {
                    return true;
                }
                clz = (clz.superclass) ? clz.superclass.constructor : null;
            } while (clz);

            return false;
        };
    }),

    initialize: function (host, sub, type, category) {
        var filterAndType = this.DELEGATE_PATTERN.exec(type),
            args;

        if (filterAndType) {
            args = toArray(arguments, 5, true),
            type = filterAndType[2];

            if (sub.category) {
                type = sub.category + '|' + type;
            }

            args.unshift(type, filterAndType[1]);

            host.delegate.apply(host, args);

            return new Y.Do.Halt("Delegating subscription", true);
        }

        return initialize.apply(this, arguments);
    }

}, true);

EventTarget.prototype.delegate = function (type) {
    var args     = toArray(arguments, 0, true),
        eventDef = this.getEvent(type);

    if (eventDef.delegate) {
        args.unshift(this);
        eventDef.delegate.apply(eventDef, args);
    }

    return this;
};

}, '0.0.1', { requires: [ 'eventx-core' ] });
