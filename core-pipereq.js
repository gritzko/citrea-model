//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./doc');

    var spcf = papyrus.spcf;
    var esc = papyrus.esc;

    var requestId = 1;
    var responseCallbacks = {};

    papyrus.on('offline', haltResponseCallbacksAfterDisconnect);

    papyrus.request = function (spec, val, callback) {
        if (papyrus.DEBUG) {
            console.log('\t<', spec, '\t', val);
        }
        if (!papyrus.pipe || !papyrus.pipe.live) {
            var respSpec = spcf.replace(spec, spcf.type(spec), ',er');

/*          CITREA-799
            if (callback) {
                callback(respSpec, 'not_connected');
            }

            return;*/
        }

        var reqId = spcf.get(spec, '#');
        if (!reqId) {
            reqId = '#' + spcf.int2seq(requestId++);
            spec = reqId + spec;
        }

        if (callback) {
            responseCallbacks[reqId] = callback;
        }

        papyrus.pipe.svsend(esc.svbuf(spec, val));
    };

    papyrus.handleResponse = function (spec, val, doc) {
        var reqId = spcf.get(spec, '#');
        if (!reqId) { throw new TypeError('no request id found in specifier: ' + spec); }

        var callback = responseCallbacks[reqId];
        if (!callback) {
            return;
        }

        delete responseCallbacks[reqId];
        callback.call(doc, spec, val);
    };

    function haltResponseCallbacksAfterDisconnect(doc) {
        var reqId;
        for (reqId in responseCallbacks) {
            papyrus.handleResponse(reqId + ',er', 'connection_lost', doc);
        }
    }

}(g['papyrus'] = g['papyrus'] || {}));
