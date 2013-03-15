YUI.add('eventx-onload', function (Y) {
/**
Wraps the window.onload event in a fireOnce custom event and overrides the
registered DOM event to route to the custom event when subscribing to 'load'
with the window as the target.

@module eventx
@submodule eventx-onload
**/
if (!Y.Global.getEvent('window.onload', true)) {
    Y.Global.publish('window.onload', {
        allowDups: false,
        fireOnce : true
    });

    if (YUI.Env.windowLoaded || Y.config.injected) {
        Y.Global.fire('window.onload');
    } else {
        YUI.Env.add(Y.config.win, 'load', function () {
            YUI.Env.windowLoaded = true;
            Y.Global.fire('window.onload');
        }, false);
    }
}

// Rather than Y.Event.publish because I'm replacing an existing DOM event, and
// don't want to modify DOMEvent, which would propagate to all events.
Y.Event.DOM_EVENTS.load = new Y.CustomEvent('load', {
    subscribe: function (target, args /* phase ignored */) {
        var isY = (target === Y),
            el  = Y.Event._resolveTarget(isY ? args[2] : target),
            win = Y.config.win,
            callback;

        if (el === win) {
            callback = args[1];
            args = toArray(args, (isY ? 3 : 2), true);

            args.unshift('window.onload', callback);

            // Default window for `this`
            if (!args[2]) {
                // Note: timing issue, if the node module is loaded after the
                // subscription is made, the callback `this` won't be a Node
                args[2] = Y.Node ? Y.one(win) : win;
            }

            return Y.Global.on.apply(Y.Global, args);
        }

        // TODO: add support for forking different elements, such as <img>,
        // <script>, or <link>
        return this._super.subscribe(target, args);
    },

    unsubscribe: function (target, args) {
        var el = Y.Event._resolveTarget(target === Y ? args[2] : target);

        if (el === Y.config.win) {
            if (args[0].detach) {
                Y.Global.detach(args[0]);
            } else {
                Y.Global.detach('window.onload', args[1], args[2]);
            }
        } else {
            this._super.subscribe.call(target, args);
        }
    }
}, Y.Event.DOMEvent);

}, '', { requires: ['eventx-dom'] });
