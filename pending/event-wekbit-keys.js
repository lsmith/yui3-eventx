YUI.add('eventx-webkit-keys', function (Y) {

if (Y.UA.webkit) {
    var keyMap = {
        63232: 38, // up
        63233: 40, // down
        63234: 37, // left
        63235: 39, // right
        63276: 33, // page up
        63277: 34, // page down
        25:     9, // SHIFT-TAB (Safari provides a different key code in
                   // this case, even though the shiftKey modifier is set)
        63272: 46, // delete
        63273: 36, // home
        63275: 35  // end
    };

    // TODO: needed for keyup, keypress?
    Y.Node._events.events.keydown = proto(Y.Node._events.defaultEvent, {
        _prepEvent: function (e) {
            if (e.keyCode in keyMap) {
                e.keyCode = keyMap[e.keyCode];
            }

            return e;
        }
    });
}

}, '0.0.1', { requires: [ 'eventx-node' ] });
