//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    require('./esc');

    var esc = papyrus.esc;

    // JSON-like interface for the line-based notation
    var LBN = {};
    LBN.parse = function (message) {
        var stack = esc.svbufParse(message.toString());
        var obj = {};
        var sv;
        //noinspection JSLint
        while (sv = stack.svpop()) {
            obj[sv.spec] = sv.val;
        }
        return obj;
    };

    LBN.stringify = function (obj) {
        var keys = [];
        var key;
        var buf = esc.svbuf();
        for (key in obj) {
            keys.push(key);
        }
        keys.sort();
        var i;
        for (i = 0; i < keys.length; i++) {
            buf.svpush(keys[i], obj[keys[i]]);
        }
        return buf.toString();
    };

    papyrus.LBN = LBN;

}(g['papyrus'] = g['papyrus'] || {}));