//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./spcf');
    require('./id4');
    require('./esc');
    require('./auth');
    require('./core');
    require('./doc-storages');

    var spcf = papyrus.spcf;

    //  P R O J E C T / D O C U M E N T

    function Doc(docId, opts) {
        opts = opts || {};
        var spcf = papyrus.spcf;
        this.spec = this.docId = docId;
        this.specSafe = spcf.safe32(this.spec);
        var p = spcf.parse(this.docId);
        this.id = p.id4;
        this.state = {};

        this.ntfNested = false;
        this.ntfQueue = [];
        this.ntfSource = {};
        this.ntfOlds = {};
        this.ntfOnClear = [];

        // this.timeMarks = [];

        this.title = '';
        // We implement sort of *loose* caching. Namely, every paragraph
        // is cached in its last rendered form. It is the most likely case that
        // next we'll have to render some incrementally changed version.
        // So, we'll have cached HTML for most of paragraphs.
        this.log = [];
        this.dirty = [];

        var key;
        for (key in (opts || {})) {
            if (opts.hasOwnProperty(key)) {
                this[key] = opts[key];
            }
        }

        if (!opts.storage) { throw new Error('no storage defined'); }

        papyrus.emit('docInit', this);

        this.storage = opts.storage;
        this.storage.load(this);
    }

    Doc.DefaultStorage = papyrus.MemStorage;
    Doc.stateFormats = {};

    //alias
    Doc._p = Doc.prototype;

    Doc._p.get = function (spec) { return this.state[spec] || ''; };
    Doc._p.has = function (spec) { return !!this.get(spec); };
    Doc._p.reset = function (spec) {
        this.set(spec, this.state[spec] || '');
    };

    Doc._p.set = function theSet(spec, val, source) {
        var doc = this;
        //var logger = self.console || console;
        if (papyrus.DEBUG) { console.log('doc:set doc="' + doc.specSafe + '" spec="' + spec + '" val="' + val + '"'); }
        spec = spcf.split(spec);
        spec = spcf.sort(spec);
        /*if (stats)
         if (spec in stats)
         stats[spec]++;
         else
         stats[spec]=1;*/
        if (val === null || val === undefined) {
            val = '';
        } else if (val.constructor !== String) {
            val = val.toString();
        }
        var id = spcf.get(spec, '!');
        if (id) {
            spec = doc.checkSeq(spec);
            if ('' === spec) {
                return ''; // voided replay
            }
        }

        var  specStr = spec.toString();
        var old_val = doc.state[specStr];

        if (val === '') {
            delete doc.state[specStr];
        } else {
            doc.state[specStr] = val;
        }

        if (spcf.has(spec, '.')) { // state

            var type = spcf.type(spec);
            var re = Doc.stateFormats[type];
            if (re && val) {
                var check2 = re.global ? !(val.replace(re, '')) : re.test(val);
                if (!check2) {
                    throw new Error('malformed state element ' + spec + '\t' + val);
                }
            }

            if (id) {
                doc.log.push(specStr);
                doc.storage.appendToLog(doc, spec, val);
                doc.relay(spec, val);
                if (doc.log.length > Doc.MAX_LOG_LENGTH * 2) {
                    doc.cutLog(Doc.MAX_LOG_LENGTH);
                }
            }

            doc.dirty.push(specStr);
            doc.scheduleFlushState();
        }

        if (!doc.ntfNested) {
            doc.ntfQueue.push(specStr);
            doc.ntfSource[specStr] = source;
            doc.ntfOlds[specStr] = old_val;
            var zpec;
            //noinspection JSLint
            while (zpec = doc.ntfQueue.shift()) { // var
                try {
                    doc.ntfNested = true;
                    var ald = doc.ntfOlds[zpec] || '';
                    delete doc.ntfOlds[zpec];
                    var n_source = doc.ntfSource[zpec] || source;
                    delete doc.ntfSource[zpec];
                    papyrus.notifyFilters(zpec, doc.state[zpec] || '', doc, n_source, ald);
                } catch (ex) {
                    console.error('notify fails for ' + zpec, ex, ex.stack); // TODO ignore? throw?
                } finally {
                    doc.ntfNested = false;
                }
            }
            var cb;
            //noinspection JSLint
            while (cb = doc.ntfOnClear.pop()) { cb(); }

            doc.ntfQueue = [];
            doc.ntfSource = {};
            doc.ntfOlds = {};
        } else {
            //noinspection JSLint
            if (!(specStr in doc.ntfOlds)) {
                doc.ntfQueue.push(specStr);
                doc.ntfSource[specStr] = source;
                doc.ntfOlds[specStr] = old_val;
                //console.log('Q '+spec);
            }
        }
        return spec; // TODO dubious
    };

    Doc._p.relay = function () {};

    Doc._p.checkSeq = function (spec) {
        spec = spcf.as(spec);
        var log_id = spcf.get(spec, '!');
        if (!log_id) { throw new Error("specifier has no log id: " + spec); }
        if (spcf.get(spec, '!', log_id)) {
            throw new Error("specifier has multiple ! tokens " + spec);
        }
        var id = spcf.parse(log_id);

        var max_seq = this.get('.MX') || "$00";
        if (id.seq === "00") { // seq is undefined yet
            id.seq = spcf.seqinc(max_seq.substr(1));
            id.ssn = this.ssn; // TODO filter inputs then
            spcf.replace(spec, log_id, id);
        }

        id.quant = '$';
        var idstr = id.toString();

        var AC = this.get('.AC');
        var ssnAc = spcf.getBySsn(AC, id.ssn);
        if (ssnAc >= idstr) {  // BAD
            console.warn("operation replay " + idstr + " (seen " + ssnAc + ")");
            console.trace();
            return '';
        }

        var newmx = '$' + id.seq;
        if (newmx > max_seq) {
            this.set('.MX', newmx);
        }
        if (ssnAc) {
            AC = spcf.replace(AC, ssnAc, idstr);
        } else {
            AC = AC + idstr;
        }
        this.set('.AC', AC);

        return spec;

    };

    Doc._p.scheduleFlushState = function () {
        var doc = this;
        if (!doc.flushJob) {
            doc.flushJob = setTimeout(function onTimeToFlush() {
                doc.storage.flushState(doc);
                delete doc.flushJob;
                doc.dirty.length = 0;
            }, Doc.FLUSH_TIMEOUT || 10000);
        }
    };

    Doc._p.discardFlushState = function () {
        var doc = this;
        if (doc.flushJob) {
            clearTimeout(doc.flushJob);
            delete doc.flushJob;
        }
    };

    Doc._p.stripSeqMark = function (spec, val, pipe) {
        var serial = spcf.get(spec, '!');
        if (!serial) { return; }

        var stripped = spcf.rm(spec, serial);
        this.set(stripped, val, pipe);
    };

    Doc._p.getMessageId = function () {
        return this.specSafe.substr(1).replace('+', '-') + '@' + papyrus.BASE_URI.hostname;
    };

    Doc._p.getMessageMeta = function (invite_code) {
        var doc = this;
        var inv = spcf.safe32(invite_code || doc.get('.ui') || '');
        return JSON.stringify({
            spec: doc.specSafe,
            inv: inv,
            host: papyrus.BASE_URI.hostname
        });
    };

    papyrus.Doc = Doc;

    papyrus.getSpecByUri = function (uri) {

        if (!papyrus.BASE_URI) { throw new Error('BASE_URI is not defined'); }

        var spec = '';
        var hash = uri.hash;
        //noinspection JSLint
        var path = uri.pathname
                .replace(/^\/for\/[^/]+/, '')
                .replace(/^(\/embed)?\/(docs|promo)/, '') + (uri.search || '');
        var hostname = uri.hostname;

        if (!hostname && uri.host) {
            var i = uri.host.indexOf(':');
            hostname = uri.host.substr(0, i == -1 ? undefined : i);
        }

        var difflen = hostname.length - papyrus.BASE_URI.hostname.length;
        var base = difflen ? hostname.substr(difflen) : hostname;

        if (base != papyrus.BASE_URI.hostname) {
            console.warn('cannot recognize hostname: ' + hostname +
                    ' (must be a subdomain of ' + papyrus.BASE_URI.hostname + ')');
            difflen = 0; //ignore
        }

        if (difflen) {
            var fakehost = hostname.substr(0, difflen - 1);
            var base32 = '/' + fakehost.replace('-', '+');

            if (!spcf.re_token32_g.test(base32)) {
                throw new Error('malformed base32 hostname: ' + fakehost);
            }
            spec = spcf.unsafe32(base32);
        }

        if (path) { // FIXME ambiguity
            path = path.substr(path.lastIndexOf('/'));
        }

        if (hash && spcf.codes.indexOf(hash.charAt(1)) !== -1) {
            hash = hash.substr(1);
        }

        if (path) {
            spec += spcf.unsafe32(path);
        }

        if (hash) {
            spec += spcf.unsafe32(hash);
        }

        return spec;
    };

    papyrus.getUriBySpec = function (spec, topPath, BASE_URI) {
        if (!BASE_URI) {
            BASE_URI = papyrus.BASE_URI;
        }

        if (!topPath) {
            topPath = '/docs';
            //noinspection JSLint
            if (typeof window !== 'undefined' && window.location.pathname.indexOf('/embed') > -1) {
                topPath = '/embed/docs';
            }
        } // FIXME fast fix

        var ret = [BASE_URI.host];
        if (papyrus.getPDDPrefix) {
            ret.push(papyrus.getPDDPrefix());
        }

        var docid = spcf.get(spec, '/');
        var docid32;
        if (docid) {
            spec = spcf.replace(spec, docid, '');
            docid32 = spcf.safe32(docid).replace('+', '-');
        }

        ret.push(topPath || '');
        ret.push('#');
        ret.push(docid32 || '');

        var safe = spcf.safe32(spec);
        if (safe) {
            ret.push(safe);
        }

        ret.unshift(BASE_URI.protocol || 'http:', '//');

        return ret.join('');
    };

    papyrus.getInviteLinkBySpec = function (spec, BASE_URI) {
        if (!BASE_URI) { BASE_URI = papyrus.BASE_URI; }

        function replacer(param) {
            switch (param) {
            case '[%=host%]':
                return BASE_URI.host;
            case '[%=docId%]':
                return spcf.safe32(spcf.get(spec, '/')).replace('+', '-').substr(1);
            case '[%=inv%]':
                return spcf.safe32(spcf.get(spec, '?')).replace('+', '-').substr(1);
            default:
                return param;
            }
        }

        if (papyrus.config && papyrus.config.globalConfig.inviteLinkTemplate) {
            //noinspection JSLint
            return BASE_URI.protocol + '//' +
                    papyrus.config.globalConfig.inviteLinkTemplate.replace(/\[%=[^%]+%]/g, replacer);
        }
        return papyrus.getUriBySpec(spec, '/docs', BASE_URI);
    };

}(g['papyrus'] = g['papyrus'] || {}));

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (val) {
        var i;
        for (i = 0; i < this.length; i++) {
            if (this[i] === val) {
                return i;
            }
        }
        return -1;
    };
}

/*Doc.addFilter('.pt',function possTitleChange(spec,text) {
    var titlePid = ';03+02';
    while (titlePid && this.state[titlePid+'.pt']===undefined)
        titlePid = this.state[titlePid+'.pn'];
    if (!titlePid) return;
    var pidpt = titlePid+'.pt';
    if (this.state[pidpt]!==this.state['.dt'])
        this.set('.dt',this.state[pidpt]);
});*/
