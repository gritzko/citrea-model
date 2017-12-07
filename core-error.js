//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./core.js');

    var errCode2handlers = {};

    papyrus.addFilter(',er', errorHandler);
    papyrus.addFilter('.er', errorHandler);

    papyrus.addErrorHandler = function (errCode, errorHandler, isPrepend) {
        var key = ((errCode == '*') ? 'onAnyErr' : ('onErr_' + errCode));
        if (!errCode2handlers[key]) { errCode2handlers[key] = []; }
        if (isPrepend) {
            errCode2handlers[key].unshift(errorHandler);
        } else {
            errCode2handlers[key].push(errorHandler);
        }
    };

    function errorHandler(spec, val, pipe) {
        var pos = val.indexOf('\t');
        var errCode, errComments;
        if (pos > -1) {
            errCode = val.substr(0, pos);
            errComments = val.substr(pos + 1);
        } else {
            errCode = val;
            errComments = '';
        }
        handleError.call(this, spec, errCode, errComments, pipe);
    }

    function handleError(spec, errCode, comments, pipe) {
        var key = 'onErr_' + errCode;
        var handlers = (errCode2handlers[key] || []).concat(errCode2handlers.onAnyErr || []);
        var i, len;
        for (i = 0, len = handlers.length; i < len; i++) {
            handlers[i].call(this, spec, errCode, comments, pipe);
        }
    }

}(g['papyrus'] = g['papyrus'] || {}));