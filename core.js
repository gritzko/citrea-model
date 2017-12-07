//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    require('./spcf.js');

    var spcf = papyrus.spcf;

    var filters = {};

    // Filters receive every operation before the session processes it.
    // A filter may amend the operation, i.e. any changes to the object
    // are effective.
    // Filters only receive operations they subscribed to.
    // The spec parameter is effectively a wildcard specifier (see
    // Specifier.covers).

    var DEFAULT_PRIORITY = 1000;
    /**
     * Extends model by registering handler for operations of specified type.
     *
     * @param {string} spec operation type as specifier
     * @param {function(string, string, WebSocket?, string?)} callback handler
     * @param {number} priority true = call this handler before early registered handlers
     */
    papyrus.addFilter = function (spec, callback, priority) {
        var t = spcf.type(spec);
        if (!t) {
            throw new Error("no type found in " + spec);
        }
        var key = 'on' + t;
        if (!filters[key]) {
            filters[key] = [];
        }
        if (!priority) { priority = DEFAULT_PRIORITY; }
        callback.priority = priority;

        var listeners = filters[key];
        var i, l;
        for (i = 0, l = listeners.length; i < l; i++) {
            var listener = listeners[i];
            if (listener === callback) { return; }
            if (listener.priority > priority) { break; }
        }
        //if (i > 0) { --i; }
        listeners.splice(i + 1, 0, callback);
    };

    papyrus.notifyFilters = function (spec, val, doc, pipe, oldval) {
        var type = spcf.type(spec);
        var key = 'on' + type;
        if (type.charAt(0) === '.' && !doc) {
            throw new Error("no state ops outside doc context");
        }
        var listeners = filters[key];
        if (!listeners) { return; }

        var i;
        for (i = 0; i < listeners.length; i++) {
            //console.log('NOTIFY',spec,'{',val,'<<<',oldval,'}',listeners[i].name);
            listeners[i].call(doc, spec, val, pipe, oldval);
        }
    };

    papyrus.appendFilter = function (spec, callback) {
        papyrus.addFilter(spec, callback, false);
    };

    papyrus.prependFilter = function (spec, callback) {
        papyrus.addFilter(spec, callback, true);
    };

    //event emitter

    var event2handlers = {};

    papyrus.on = function (eventName, handler) {
        if (!eventName) { throw new TypeError('no event name specified'); }
        if (!handler) { throw new TypeError('no handler specified'); }

        if (!event2handlers[eventName]) {
            event2handlers[eventName] = [];
        }
        event2handlers[eventName].push(handler);
    };

    papyrus.off = function (eventName, handler) {
        if (!eventName) { throw new TypeError('no event name specified'); }

        if (!handler) { //remove all handlers
            delete event2handlers[eventName];
        } else {
            var handlers = event2handlers[eventName];
            if (!handlers) { return; }

            var pos = handlers.indexOf(handler);
            if (pos > -1) {
                handlers.splice(pos, 1);
            }
        }
    };

    papyrus.emit = function (eventName) {
        if (!eventName) { throw new TypeError('no event name specified'); }

        var handlers = event2handlers[eventName];
        if (!handlers) { return false; } // no handlers registered
        var params = Array.prototype.slice.call(arguments, 1);
        if (papyrus.DEBUG) { console.log('emit ', eventName, params, handlers.length); }
        var i, l;
        for (i = 0, l = handlers.length; i < l; i++) {
            handlers[i].apply(null, params);
        }
        return true;
    };

}(g['papyrus'] = g['papyrus'] || {}));