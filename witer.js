//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,ThisExpressionReferencesGlobalObjectJS,JSLint
(function (papyrus) {
    "use strict";

    require('./spcf.js');

    /** The weave is now kept in the state map as a sum of
     *  paragraph weavelets. */
    function WIter(doc, pos, hint) {
        if (doc.constructor === WIter) {
            this.doc = doc.doc;
            this.match = doc.match;
            this.pid = doc.pid;
        } else {
            this.doc = doc;
            this.setPosition(hint || ';03+02');
            if (!this.match) {
                this.setPosition(';03+02');
            }
            if (pos) {
                this.moveTo(pos);
            }
            //if (!this.match)
            //    throw new Error("location unknown "+hint+' '+pos);
        }
    }

    WIter._p = WIter.prototype;

    WIter._p.parse = function () {
        var m = this.match;
        return {
            pid: this.pid,
            symb: m[1],
            id: m[2] + m[3],
            seq: m[2],
            ssn: m[3],
            pos: ':' + m[2] + (m[3] !== '00' ? '+' + m[3] : ''),
            meta: m[4],
            lead: m[5],
            leadseq: m[6],
            leadssn: m[7]
        };
    };

    WIter._p.moveTo = function (pos_id) {
        var spcf = papyrus.spcf;
        var loc = spcf.parse(pos_id);
        if (loc.quant !== ':') {
            throw new Error("strange position spec: " + pos_id);
        }

        while (this.match) {
            var off = this.match.index - 1;
            do {
                off = this.match.input.indexOf(loc.id4, off + 1);
            } while (off !== -1 && (off % 5) !== 1);
            if (off !== -1) {
                this.next(off - 1);
                break;
            }
            this.setPosition();
        }

    };

    WIter._p.setPosition = function (pid, off) {
        this.pid = pid || this.doc.get(this.pid + '.pn');
        if (!this.pid) {
            this.match = null; // doc is over
            return null;
        }
        var weavelet = this.doc.get(this.pid + '.pw');
        if (weavelet.length % 5) {
            throw new Error('malformed weavelet ', weavelet.length);
        }
        var spcf = papyrus.spcf;
        spcf.re_atom5_g.lastIndex = off || 0;
        this.match = spcf.re_atom5_g.exec(weavelet);
        return this.match;
    };

    WIter._p.getWeaveOffset = function () {
        var ret = this.match.index;
        for (var p = this.pid; p; p = this.doc.get(p + '.pp')) {
            if (p!=this.pid)
                ret += this.doc.get(p + '.pw').length;
        }
        return ret;
    };

    WIter._p.next = function (off) {
        var spcf = papyrus.spcf;
        spcf.re_atom5_g.lastIndex = (off === undefined) ?
                this.match.index + this.match[0].length : off;
        this.match = spcf.re_atom5_g.exec(this.match.input);
        return this.match || this.setPosition();
    };

    WIter._p.insert = function (val, ser_id) {
        if (val.length !== 1) {
            throw new Error("can only insert a single symbol");
        }
        var iter = this;
        var doc = this.doc;
        var off = this.match.index;
        var weavelet = this.match.input;
        var idTok = papyrus.spcf.parse(ser_id);
        if (idTok.quant !== '!') {
            throw new Error("incorrect serial id " + ser_id);
        }

        var atom = val + idTok.id4;

        if (val === '\u0008') { // remove mark
            if (off === 0) { // join paragraphs
                join(off + 5);
            } else { // simple insert
                simpleInsert(off + 5);
            }
        } else if (val === '\u0018') { // undel mark
            if (iter.match[1] === '\n') {
                split(off, true);// restore split
            } else {
                simpleInsert(off + 5);
            }
        } else {
            if (val === '\n') {    // split
                split(off + iter.match[0].length, false);
            } else { // insert atom
                simpleInsert(off + iter.match[0].length);
            }
        }

        function join(offset) {
            var wHead = weavelet.substr(0, offset);
            var wTail = weavelet.substr(offset);

            if (idTok.id4 === '0300') { //FIXME ??? '0302'
                throw "can't remove the head newline";
            }
            var prev_pid = doc.get(iter.pid + '.pp');
            var prev_weavelet = doc.get(prev_pid + '.pw');
            var next_pid = doc.get(iter.pid + '.pn');
            doc.set(prev_pid + '.pn', next_pid);
            if (next_pid) {
                doc.set(next_pid + '.pp', prev_pid);
            }
            doc.set(iter.pid + '.pn', '');
            doc.set(iter.pid + '.pp', '');

            //only in replica the operation source
            if (idTok.ssn === doc.ssn && ('function' === typeof (doc.copyMediaContent))) {
                doc.copyMediaContent(iter.pid, prev_pid);
            }

            doc.set(prev_pid + '.pw', prev_weavelet + wHead + atom + wTail);
            doc.set(iter.pid + '.pw', '');
            doc.rebulletize(prev_pid, true);
            iter.setPosition(prev_pid, prev_weavelet.length); // ATTN
        }

        function split(offset, metaSymbol) {
            var wHead = weavelet.substr(0, offset);
            var toInsert, wTail, new_p_spec;

            if (metaSymbol) {
                new_p_spec = ';' + iter.match[2] + (iter.match[3] === '00' ? '' : '+' + iter.match[3]);
                toInsert = iter.match[1] + iter.match[2] + iter.match[3] + atom;
                wTail = weavelet.substr(offset + 5);
            } else {
                new_p_spec = idTok.token.replace('!', ';');
                toInsert = atom;
                wTail = weavelet.substr(offset);
            }

            var next_spec = doc.get(iter.pid + '.pn');
            // etiquette: once you point at something,
            // it must be already initialized;
            // just imagine it breaks midway and act accordingly
            doc.set(new_p_spec + '.pp', iter.pid);
            doc.set(iter.pid + '.pn', new_p_spec);
            if (next_spec) {
                doc.set(next_spec + '.pp', new_p_spec);
                doc.set(new_p_spec + '.pn', next_spec);
            }
            doc.set(iter.pid + '.pw', wHead);
            doc.set(new_p_spec + '.pw', toInsert + wTail);
            iter.setPosition(new_p_spec, 0);
        }

        function simpleInsert(offset) {
            var wHead = weavelet.substr(0, offset);
            var wTail = weavelet.substr(offset);
            doc.set(iter.pid + '.pw', wHead + atom + wTail);
            iter.setPosition(iter.pid, offset);
        }
    };

    papyrus.WIter = WIter;

}(g['papyrus'] = g['papyrus'] || {}));

