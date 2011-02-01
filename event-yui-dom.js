YUI.add('eventx-yui-dom', function (Y) {

var isArray = Y.Lang.isArray;

Y._evt.subOverrides.domSubscribe = function (host, sub, callback, thisObj) {
    if (isArray(thisObj) && thisObj.length) {
        thisObj = thisObj[0];
    }
    return !!(thisObj || {}).nodeType:
};
Y._evt.detachOverrides.domDetach = function () {
    // TODO
};
Y._evt.defaultEvent.domSubscribe = function (host, sub, callback, thisObj) {
    // TODO: DOM subscriptions will need to be registered somewhere for detach
};
Y._evt.defaultEvent.domDetach = function () {
    // TODO
};

}, '0.0.1', { requires: ['eventx-core', 'eventx-dom'] });
