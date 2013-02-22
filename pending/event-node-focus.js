YUI.add('event-node-focus', function (Y) {

var config = Y.Node._event;

config.events.focus = Y.Object(config.defaultEvent, {

    init: function (host, type, phase, callback, thisObj) {
    }

});

}, '0.0.1', { requires: ['event-node'] };
