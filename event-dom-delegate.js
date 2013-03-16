YUI.add('eventx-dom-delegate', function (Y) {
/**
Adds DOM event delegation support to Y.Event.

@module eventx
@submodule eventx-dom-delegate
**/
var toArray = Y.Array,
    isArray = Y.Lang.isArray;

Y.mix(Y.Event.DOMEvent, {
    delegate: function (target, args) {
        var type = args[0],
            sub  = null,
            el, eventKey, callback, filter, selector, subs, i, len;

        // Convert from arguments object to array
        args = toArray(args, 0, true);

        if (target === Y) {
            // delegate(type, callback, container, filter, thisObj, ...args)
            // => delegate(type, callback, filter, thisObj, ...args)
            target = args.splice(2,1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el && el.nodeType) {
            callback = args[1];
            filter   = args[2];

            if (typeof filter === 'string') {
                selector = filter;
                filter   = this.selectorFilter;
            }

            // delegate(type, callback, filter, thisObj, ...args)
            // => on(type, delegateNotify, thisObj, ...args)
            args.splice(1, 2, this.delegateNotify);

            // => on(eventKey, delegateNotify, thisObj, ...args)
            eventKey = args[0] = Y.stamp(el) + ':' + type;

            sub = new this.Subscription(Y, args, 'on', {
                callback : callback,
                filter   : filter,
                container: el,
                selector : selector,
                domType  : type,
                setThis  : !(args[2])
            });

            this.registerSub(el, sub);
        } else if (el && typeof el.length === 'number') {
            subs = [];
            for (i = 0, len = el.length; i < len; ++i) {
                subs.push(this.delegate(el[i], args));
            }

            // Return batch subscription
            sub = new Y.CustomEvent.Subscription(subs);
        }

        return sub;
    },

    delegateNotify: function (e) {
        var sub     = e.subscription,
            details = sub && sub.details,
            filter  = details && details.filter,
            container, target, currentTarget, setThis;

        if (filter) {
            container = details.container;
            target    = e._event.target || e._event.srcElement;
            setThis   = details.setThis;

            e.set('container', container);

            while (target.nodeType === 3) {
                target = target.parentNode;
            }

            while (target) {
                e.set('currentTarget', target);

                if (filter.call(sub, e)) {
                    currentTarget = setThis ? e.get('currentTarget') : this;
                    // arguments contains e, which has had its currentTarget
                    // updated.
                    details.callback.apply(currentTarget, arguments);
                }

                if (e.stopped || target === container) {
                    break;
                }

                target = target.parentNode;
            }
        }
    },

    selectorFilter: function (e) {
        var currentTarget = e.data.currentTarget,
            container     = e.data.container,
            root          = currentTarget === container ? null : container;

        return Y.Selector.test(currentTarget, this.details.selector, root);
    }
}, true);

Y.Event.EventFacade.prototype._getter.container = function () {
    return this.data.container ||
           (this.subscription &&
            this.subscription.details &&
            this.subscription.details.container);
};

}, '', { requires: [ 'eventx-dom', 'eventx-delegate' ] });
