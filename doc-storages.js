//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {

    function MemStorage(serverside) {
        this.serverside = serverside;
    }

    MemStorage.data = {};
    MemStorage.prototype.load = function (doc) {
        var self = this;
        if (MemStorage.data[doc.spec] && MemStorage.data[doc.spec]['.ok']) {
            doc.state = MemStorage.data[doc.spec];
            setTimeout(function () {
                doc.reset('.ok');
            }, 0);
        } else if (self.serverside) {
            doc.set('.ok', doc.docId + '*00');
        } else {
            MemStorage.data[doc.spec] = doc.state;
        }
    };
    MemStorage.prototype.appendToLog = function () {};
    MemStorage.prototype.flushState = function () {};
    MemStorage.prototype.close = function memsClose(doc, cb) {
        if (cb) { cb(); }
    };

// for historical snapshots mostly
    function NoStorage() {}
    NoStorage.prototype.load = function () {};
    NoStorage.prototype.appendToLog = function () {};
    NoStorage.prototype.flushState = function () {};
    NoStorage.prototype.close = function (doc, cb) {
        if (cb) { cb(); }
    };

    papyrus.NoStorage = NoStorage;
    papyrus.MemStorage = MemStorage;

}(g['papyrus'] = g['papyrus'] || {}));