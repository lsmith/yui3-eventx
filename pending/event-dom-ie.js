YUI.add('eventx-dom-ie', function (Y) {
    var win   = Y.config.win,
        doc   = Y.config.doc,

        YEventDOM = Y.EventX.DOM,
        getEl = YEventDOM._getEl;

    if (!doc.addEventListener && doc.attachEvent) {

        Y.mix(YEventDOM, {
            listen: function (yuid, type, callback) {
                // element is not stored as a variable to avoid IE mem leak
                var wrapped = function () {
                    callback.call(getEl(yuid), win.event);
                };
                getEl(yuid).attachEvent("on" + type, wrapped);
                return wrapped;
            },
            unlisten: function (yuid, type, callback) {
                getEl(yuid).detachEvent("on" + type, callback);
            },

            stop   : function (e) { e.cancelBubble = true; },
            prevent: function (e) { e.returnValue = false; }
        }, true);
    }

}, '0.0.1', { requires: ['eventx-dom'] });
