YUI.add('eventx-node-delegate', function (Y) {

var YEventDOM = Y.EventX.DOM;

YEventDOM._events.publish({
    type: '_DEFAULT',
    compileFilter: Y.cached(function (filter) {
        return function (e) {
            return e.get('target').test(filter);
        };
    })
});

Y.Node.prototype.delegate = function (type) {
    var args = Y.Array(arguments, 0, true);
    args.unshift(this._node);
    YEventDOM.delegate.apply(YEventDOM, args);

    return this;
}

}, '0.0.1', { requires: [ 'eventx-dom-delegate', 'node' ] });
