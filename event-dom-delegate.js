YUI.add('eventx-dom-delegate', function (Y) {

var YEventDOM = Y.EventX.DOM,
    eventMgr  = YEventDOM._events,
    test      = Y.Selector.test;

eventMgr.publish({
    type: '_DEFAULT',
    compileFilter: Y.cached(function (filter) {
        return function (e) {
            return test(e.get('target'), filter);
        };
    })
});

YEventDOM.delegate = function (el, type, filter) {
    if (el && el.nodeType && type && filter) {
        var args = toArray(arguments, 0, true);

        // TODO: Hmmm, will have to think through this.
        args[0] = type; // params reversed for more natural API
        args[1] = el;

        eventMgr.delegate.apply(eventMgr, args);
    }

    return YEventDOM;
};

}, '0.0.0', { requires: ['event-dom'] });
