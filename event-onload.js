YUI.add('eventx-onload', function (Y) {
/**
Wraps the window.onload event in a fireOnce custom event and overrides the
registered DOM event to route to the custom event when subscribing to 'load'
with the window as the target.

@module eventx
@submodule eventx-onload
**/
if (!Y.Global.getEvent('window.onload')) {
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

Y.Event.publish('load', {
    subscribe: function (target, args /* phase ignored */) {
        var el;

        if (target === Y) {
            args   = toArray(args, 0, true);
            target = args.splice(2, 1)[0];
        }

        el = Y.Event._resolveTarget(target);

        if (el === Y.config.win) {
            args[0] = 'window.onload';
            return Y.Global.on.apply(Y.Global, args);
        }

        // TODO: add support for forking different elements, such as <img>,
        // <script>, or <link>
        return this._super.subscribe.call(target, args);
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
