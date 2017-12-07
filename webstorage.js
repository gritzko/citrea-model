//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    require('./doc');

    var isIE = papyrus.isIE;

    var spcf = papyrus.spcf;
    var esc = papyrus.esc;
    var MemStorage = papyrus.MemStorage;

    function Html5Storage() {
        var w = window;
        var spec = papyrus.getSpecByUri(w.location);
        var docId = spcf.get(spec, '/');
        if (!docId) {
            docId = '/00'; //throw new Error('no docid');
        }
        var mode = 'HOST';
        var sd = spcf.safe32(docId);
        if (w.location.pathname.indexOf(sd) !== -1) {
            mode = 'PATH';
        } else if (w.location.hash.indexOf(sd) !== -1) {
            mode = 'HASH';
        }

        if (mode === 'HOST' && w.localStorage) {
            this.storage = w.localStorage;
        } else if (mode === 'PATH' && w.sessionStorage) {
            this.storage = window.sessionStorage;
        } else if (mode === 'HASH' && w.sessionStorage) {
            this.storage = new MemStorage();
            //this.storage = window.sessionStorage;
        } else {
            throw new Error('HTML5 storage is not supported');
        }
        // TODO unlimitedStorage
    }

    Html5Storage._p = Html5Storage.prototype;
    Html5Storage.FORMAT_VERSION = '0.2 all prefixed';
    //if (window.localStorage)
        //Doc.DefaultStorage = Html5Storage;

    Html5Storage._p.load = function webStorageLoad(doc) {
        var self = this;
        doc.storingPrefix = doc.spec.replace('/', '%');
        var store = self.storage;
        if (store.getItem('.SV') != Html5Storage.FORMAT_VERSION) {
            store.clear();
            store.setItem('.SV', Html5Storage.FORMAT_VERSION);
            return;
        }
        var ok = store.getItem(doc.storingPrefix + '.ok');
        if (!ok) {
            return;
        }
        var plen = doc.storingPrefix.length;
        var i, len;
        for (i = 0, len = store.length; i < len; i++) {
            var spec = store.key(i);
            var val = store.getItem(spec);
            if (spec.substr(0, plen) === doc.storingPrefix) { // FIXME aa00 !== aabb
                spec = spec.substr(plen);
            } else if (spec.charAt(0) === '%') {
                continue; // other doc
            }
            if (isIE) {
                val = esc.unesc(val);
            }
            doc.state[spec] = val;
        }
        doc.set('.ok', ok);

        var sync = function (ev) {
            self.syncTabs(ev);
        };

        if (!isIE) {
            window.addEventListener('storage', sync);
        } else {
            window.attachEvent('onstorage', sync);
        }
    };

    MemStorage.prototype._load = MemStorage.prototype.load;
    MemStorage.prototype.load = function (doc) {
        var self = this;
        doc.storingPrefix = doc.spec.replace('/', '%');
        this._load(doc);
        var sync = function (ev) {
            self.syncTabs(doc, ev);
        };
        if (!isIE) {
            window.addEventListener('storage', sync);
        } else {
            window.attachEvent('onstorage', sync);
        }
    };

    var rere;

    function syncTabs(doc, ev) {
        var spec = ev.key;
        var val = ev.newValue;
        if (!val) { return; } // cleanup

        if (spec.substr(0, 3) !== '*xx') { return; } // some piece of state

        spec = spec.substr(3);
        if (spec.substr(0, doc.storingPrefix.length) !== doc.storingPrefix) { return; } //other doc

        spec = spec.substr(doc.storingPrefix.length);
        if (spec.charAt(0) !== '!') { return; } // some state, not an op

        if (doc.state[spec]) { return; } // already has op

        var p = spcf.parse(spec);
        var AC = doc.get('.AC');
        var ssnAc = spcf.getBySsn(AC, p.ssn);
        if (ssnAc.substr(1) >= p.token.substr(1)) { return; } // replay; dunno why

        doc.set(spec, val);
        if (!rere) { // DIRTY FIX )))
            rere = setTimeout(function () {
                doc.renderPendingParagraphs();
                rere = null;
            }, 1);
        }
    }

    MemStorage.prototype.syncTabs = syncTabs;
    Html5Storage.prototype.syncTabs = syncTabs;

    Html5Storage._p.appendToLog = function webStorageWrite(doc, spec, val) {
        var self = this;
        if ((spec.constructor == String ? spec : spec[0]).charAt(0) !== '/') {
            spec = doc.storingPrefix + spec;
        }
        if (val) {
            if (isIE) {
                val = esc.esc(val);
            }
            self.storage.setItem(spec.toString(), val);
        } else {
            self.storage.removeItem(spec.toString());
        }
        if (window.localStorage && spec.indexOf('!') !== -1) {
            window.localStorage.setItem('*xx' + spec, val);
            window.localStorage.removeItem('*xx' + spec);
        }
    };

    MemStorage.prototype.appendToLog = function memStorageWrite(doc, spec, val) {
        if ((spec.constructor == String ? spec : spec[0]).charAt(0) !== '/') {
            spec = doc.storingPrefix + spec;
        }
        if (isIE) {
            val = esc.esc(val);
        }
        if (window.localStorage && spec.indexOf('!') !== -1) {
            window.localStorage.setItem('*xx' + spec, val);
            window.localStorage.removeItem('*xx' + spec);
        }
    };

    var NO_STORE = {'.in': 1, '.rm': 1, '.ud': 1};

    Html5Storage._p.flushState = function webStorageFlushState(doc) {
        var self = this;
        var spec;
        var done = {};
        // FIXME rework: dirty/log - unclear
        doc.dirty.reverse();
        //noinspection JSLint
        while (spec = doc.dirty.pop()) {
            if (!done[spec]) {
                self.appendToLog(doc, spec, doc.state[spec]); // FIXME other name
                done[spec] = 1;
            }
        }
        var ackd = doc.get('.ac') || '$00';
        var ackedSeq = spcf.parse(ackd).seq;
        var newLog = [];
        // erase every no-store op acked by the server
        //noinspection JSLint
        while (spec = doc.log.pop()) { // FIXME move out of here
            var serial = spcf.get(spec, '!');
            var pse = spcf.parse(serial);
            if (pse.ssn == doc.ssn && pse.seq > ackedSeq) {
                newLog.push(spec);
            } else if (NO_STORE[spcf.get(spec, '.')]) {
                self.appendToLog(doc, spec, '');
            }
        }
        doc.log = newLog.reverse();
    };

    papyrus.Html5Storage = Html5Storage;



}(g['papyrus'] = g['papyrus'] || {}));
