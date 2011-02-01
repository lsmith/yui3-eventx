/**
 * Adds support to Y.on for element-first subscription signature, ala
 * <code>Y.on('#foo', 'click', fn);</code>
 *
 * @module event
 * @submodule event-inverse-subscribe
 */
YUI.add('eventx-inverse-subscribe', function (Y) {

var YLang      = Y.Lang,
    isArray    = YLang.isArray,
    isString   = YLang.isString,
    isFunction = YLang.isFunction;

Y._yuievt.subOverrides.inverseSubscribe = function (host, sub) {
    // Y.on('#foo', 'click', fn);
    // is passed through as type='#foo', callback='click', thisObj=fn
    var el = sub.type;

    if (isArray(el)) {
        el = el[0];
    }
    return (el.nodeType || isString(el)) &&
            isString(sub.callback)      &&
            isFunction(sub.thisObj);
};

Y.publish({
    type: '_DEFAULT',

    inverseSubscribe: function (host, sub) {
        var args = sub.payload || [];

        args.unshift(sub.callback, sub.thisObj, sub.type);

        Y.on.apply(Y, args);

        return false;
    }
});

}, '0.0.1', { requires: ['eventx-dom'] });
