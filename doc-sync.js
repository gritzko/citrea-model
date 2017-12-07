//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint,ThisExpressionReferencesGlobalObjectJS
(function (papyrus) {
    require('./core');
    require('./doc');

    var Doc = papyrus.Doc;
    var spcf = papyrus.spcf;

    Doc._p.getVersionVector = function () {
        return this.get('.AC');
    };

    Doc._p.buildLog = function () {
        var doc = this;
        doc.log = [];
        var spec;
        for (spec in doc.state) {
            if (spec.charAt(0) !== '!') { continue; }

            var serial = spcf.get(spec, '!');
            if (!serial) { continue; }

            if (doc.ssn === '00' || spcf.parse(serial).ssn === doc.ssn) {
                // FIXME BAD; check ssn only if needed
                doc.log.push(spec);
            }
        }
        doc.log.sort();
        doc.applyPendingTail();
    };

    Doc._p.getSsnList = function () {
        var sn = this.get('.SN');
        var m;
        var ret = [];
        spcf.re_token_g.lastIndex = 0;
        //noinspection JSLint
        while (m = spcf.re_token_g.exec(sn)) {
            ret.push(m[2] || '00');
        }
        return ret;
    };

    Doc._p.getDiff = function (acks, cli_ssn, ignore_no_tail) {
        var doc = this;
        var peerMap = spcf.ssnMap(acks);  // no zeros
        var myMap = spcf.ssnMap(doc.get('.AC')); // no zeros
        var cutMap = spcf.ssnMap(doc.get('.SN')); // zeros
        var diffMap = {};
        var ret = [];
        var stillPending = 0;
        var ssn;
        for (ssn in myMap) {
            var peerSeq = peerMap[ssn] || '00';
            var mySeq = myMap[ssn];
            if (mySeq > peerSeq) {
                if (peerSeq < cutMap[ssn] && !ignore_no_tail) { return null; } // no tail

                diffMap[ssn] = peerSeq;
                stillPending++;
            } else if (mySeq < peerSeq && ssn !== cli_ssn) {
                doc.storage.recheckLog(doc);
                throw new Error('client ahead', ssn);
            }
        }
        var i;
        for (i = doc.log.length - 1; i >= 0 && stillPending; i--) {
            var spec = doc.log[i];
            var serial = spcf.getParsed(spec, '!');
            if (diffMap[serial.ssn]) {
                if (serial.seq > diffMap[serial.ssn]) {
                    ret.push(spec);
                } else {
                    delete diffMap[serial.ssn];
                    stillPending--;
                }
            }
        }
        ret.sort();
        return ret; // stack; older at the top
    };


    Doc._p.cutLog = function (length) {
        var doc = this;
        var bottomMap = spcf.ssnMap(doc.get('.SN'));
        var log = doc.log.reverse();
        while (log.length > length) {
            var spec = log.pop();
            var ser = spcf.getParsed(spec, '!');
            bottomMap[ser.ssn] = ser.seq;
            if (spec.indexOf('.in') === -1 && spec.indexOf('.rm') === -1) { continue; }

            delete doc.state[spec];
            doc.storage.appendToLog(doc, spec, '');
        }
        var newsn = [];
        var ssn;
        for (ssn in bottomMap) {
            newsn.push('$' + bottomMap[ssn] + (ssn === '00' ? '' : '+' + ssn));
        }
        newsn.sort();
        doc.set('.SN', newsn.join(''));
        doc.log = log.reverse();
    };

    Doc._p.applyPendingTail = function aPT() {
        var doc = this;
        var ackMap = spcf.ssnMap(doc.get('.AC'));
        var log = this.log;
        var applied = 0;
        this.log = [];
        var i;
        for (i = 0; i < log.length; i++) {
            var serial = spcf.getParsed(log[i], '!'); // :(
            if ((ackMap[serial.ssn] || '00') < serial.seq) {
                doc.reset(log[i]);
                applied++;
            }
        }
        doc.log = log;
        (doc.console || console).debug('doc:applyPendingTail logRecordsApplied="%d" logRecordsTotal="%d"',
                applied, log.length);
    };

    // Once we reconnect to the server we might find that seq had advanced far
    // forward and our offline seqs will confuse version control. Thus, we
    // rollback all the offline-created content and append it once again
    // using up-to-date sequence numbers (seqs).
    Doc._p.renumberTail = function () {
        throw new Error("not implemented yet");
    };

    function maintainSessionList(spec) {
        var id = spcf.getParsed(spec, '!');
        if (!id) { throw new Error('no "!"-quant in specifier: ' + spec); }
        var sessionIds = this.get('.SN') || '$00';
        sessionIds += '$00+' + id.seq;
        this.set('.SN', sessionIds);
    }

    function assignReplicaId(spec, val) {
        var doc = this;
        var ssn = papyrus.spcf.get(val, '*');
        doc.ssn = ssn ? ssn.substr(1) : null; // ?
    }

    function notifyDocReady() {
        papyrus.emit('docReady', this);
    }

    papyrus.addFilter('.sn', maintainSessionList);
    papyrus.addFilter('.ok', assignReplicaId);
    papyrus.addFilter('.ok', notifyDocReady, 100000);

}(g['papyrus'] = g['papyrus'] || {}));