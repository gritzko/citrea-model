//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint,ThisExpressionReferencesGlobalObjectJS
(function (papyrus) {
    require('./doc');

    var spcf = papyrus.spcf;
    var id4 = papyrus.id4;

    var RE_URI = new RegExp(
        "(?:(https?|ftps?|wss?):)" +    // scheme
            "(?://" +
                "(?:([^/?#\\s]*)@)?" +                  // credentials
                "((?:[^/?#:@\\s]+\\.)*[^/?#:@\\s]+)" + // domain
                "(?::([0-9]+))?" +                    // port
            ")" +
            "(/[^?#'\"\\s]*)?" +         // path
            "(?:\\?([^'\"#\\s]*))?" +   // query
            "(?:#(\\S*))?",            // fragment
        "gi"
    );
    papyrus.RE_URI = RE_URI;

    papyrus.addFilter('.pt', parseURIs);

    function parseURIs(spec, text) {
        var doc = this;
        if (doc.promo) { return; } //skip uri parsing

        var pid = spcf.get(spec, ';');
        var ids = doc.get(pid + '.id');
        var new_traps = [];
        var m;
        var starts = {};
        RE_URI.lastIndex = 0;
        // find URIs in the string
        while (m = RE_URI.exec(text)) {
            // locate formatting change points
            var from = m.index ? id4.at(ids, m.index - 1) : pid.replace(';', ':');
            var till = id4.at(ids, m.index + m[0].length - 1);
            new_traps.push(from, till);
            // remember the URI
            var start = id4.at(ids, m.index);
            if (doc.get(start + '.go') != m[0]) {
                doc.set(start + '.go', m[0]);
            }
            starts[start] = true;
        }
        var old_traps = doc.get(pid + '.um');  // the previous state
        new_traps = new_traps.join('');
        if (old_traps === new_traps) {
            return; // no changes => don't touch
        }

        // update traps (formatting change points)
        doc.walkTraps(old_traps, '#ur', spcf.rm);
        doc.walkTraps(new_traps, '#ur', spcf.add);

        // forget URIs that disappeared
        var clr = spcf.split(old_traps), c;
        while (c = clr.pop()) {
            if (!starts[c]) {
                doc.set(c + '.go', '');
            }
        }
        doc.set(pid + '.um', new_traps); // record the state
        doc.reset(pid + '.pw'); // redraw the paragraph
    }

}(g['papyrus'] = g['papyrus'] || {}));
