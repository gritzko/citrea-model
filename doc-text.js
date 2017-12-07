//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./doc');
    require('./witer');

    var Doc = papyrus.Doc;
    var spcf = papyrus.spcf;
    var id4 = papyrus.id4;
    var esc = papyrus.esc;
    var WIter = papyrus.WIter;

    var rs_dvoika = spcf.rs_seq + '(?:\\+' + spcf.rs_seq + ')?';
    var re_at = new RegExp(
        "^((?:\\:$2)*)\\s*((?:\\;$2)*)\\s*([\\w-]+)([:=_])('[^']*'|[\\w, -]*)$"
            .replace(/\$2/g, rs_dvoika)
    );

    Doc.stateFormats['.pw'] = new RegExp(spcf.rs_atom5, 'mg');
    Doc.stateFormats['.at'] = re_at;

    var meta_allowed = {
        'head_' : /\d?/,
        'list_' : /o|v|1|/,
        'text-align:' : /left|right|center|justify/,
        'font-family:' : /[\w, -]+|/,
        'font-weight:': 'bold',
        'font-style:':  'italic',
        'text-decoration:': 'underline',
        'background:': /\w+/,
        'href=': /^'http:\/\/\S*/,
        's_'   : '',
        'au='  : '',
        'rmau='  : '',
        'noauthor_': 'on',
        'selected_': 'on',
        'uri_' : '',
        'rm_': 'on',
        'old_': 'on',
        'indent_' : /\d?/,
        'comment_': 'on',
        'check_' : 'ok'
    };

    function insertSymbol(spec, value) {
        var doc = this;
        spec = spcf.split(spec);
        //if (!value || value.length!==1)  TODO no \t\b
        //    throw new Error("can only insert a single symbol");
        var loc = spcf.get(spec, ':');
        var hint = spcf.get(spec, ';');
        var id = spcf.get(spec, '!');
        var id4 = spcf.parse(id).id4;
        var i = new WIter(doc, loc, hint);
        if (!i.match) {
            console.trace('loc not found ' + spec);
            throw new Error('location not found: ' + spec);
        }
        var next = new WIter(i);
        while (next.next() && next.parse().id > id4) {
            i.next(); // UGLY
        }
        var j, len;
        for (j = 0, len = value.length; j < len; j++) {
            var chr = value.charAt(j);
            if (chr>='\ud800') chr=' ';
            i.insert(chr, id);
            if (j !== len - 1) {
                id = spcf.tokinc(id);
            }
        }
        var lastId = spcf.parse(id);
        if (value.length > 1) {
            doc.checkSeq(lastId);
        }
        if (lastId.ssn === this.ssn) {
            var p = i.parse();
            doc.set(',se', p.pid + p.pos); // FIXME think
        }
    }

    function markSymbolDelUndel(spec, value) {
        var doc = this,
            marker = ((spcf.type(spec) === '.rm') ? '\u0008' : '\u0018'),
            loc = spcf.split(value).reverse(),
            idTok = spcf.get(spec, '!'),
            initialId = idTok,
            ssn = spcf.parse(idTok).ssn,
            i = new WIter(doc),
            tok, lastTok;
        //noinspection JSLint
        while (tok = loc.pop()) {
            var quant = tok.charAt(0);
            if (quant === ';') {
                i.setPosition(tok);
            } else if (quant === ':') {
                i.moveTo(tok);
                if (!i.match) {
                    i = new WIter(this);
                    i.moveTo(tok);
                    if (!i.match) {
                        throw 'position unknown: ' + tok;
                    }
                }
                i.insert(marker, idTok);
                lastTok = i.pid + tok;
                if (loc.length) {
                    idTok = spcf.tokinc(idTok);
                }
            } else {
                throw 'inappropriate token in a .rm op: ' + quant;
            }
        }
        if (initialId !== idTok) {
            doc.checkSeq(idTok);
        }
        if (marker === '\u0018' && lastTok && ssn === this.ssn) {
            doc.set(',se', lastTok);
        }
    }

    //noinspection JSLint
    var re_same_ssn = /..(..)(..\1)*/g;

    var entities = {'<': "&lt;", '>': "&gt;", '&': "&amp;"};

    function markParagraphNeedRender(spec) {
        var doc = this;
        var pid = spcf.get(spec, ';');
        if (pid === ';03+02') {
            doc.renderParagraph(pid);
            return;
        }
        var p2render = doc.get('.PP') || '';
        if (p2render.indexOf(pid) === -1) {
            doc.set('.PP', p2render + pid);
        }
    }

    function recheckMarkup(spec, value, src, oldval) {
        if (value == oldval) { return; }

        var pid = spcf.get(spec, ';');
        var next_pid = this.get(pid + '.pn');
        if (!next_pid) { return; }

        var mi = next_pid + '.mi';
        if (this.state[mi] != value) {
            this.reset(next_pid + '.pw');
        }
    }

    Doc._p.getSiblingPid = function (pid, back) {
        var myAtts = this.getParagraphAtts(pid),
            myIndent = myAtts.indent_ || '0',
            p = pid;
        while (p = this.get(p + (back?'.pp':'.pn'))) {
            var indent = this.getParagraphAtts(p).indent_ || '0';
            if (myIndent === indent) return p;
            if (indent < myIndent) return '';
            //console.log('skip',p,indent,myIndent);
        }
        return '';
    };

    function bulletize(spec, value) {
        var m = re_at.exec(value);
        if (m[1]) return;
        var prange = m[2];
        this.walkParagraphs(prange, rebulletize);
    }

    function rebulletize(pid, force_recalc) {
        if (!pid) return;
        var atts = this.getParagraphAtts(pid),
            old_bullet = (this.get(pid + '.bc') || '&nbsp;'),
            bullet = '&nbsp;';
        switch (atts.list_) {
        case 'o':
            bullet='\u2022'; break;
        case 'v':
            bullet='&nbsp;'; break; //atts.check_? '\u2611':'\u2610'; break;
        case '1':
            var re_list = /^((?:\d+\.)*)(\d+)\.$/,
                prev_sibling_pid = this.getSiblingPid(pid, true);
            if (prev_sibling_pid) {
                var sbul = this.get(prev_sibling_pid + '.bc'),
                    m = re_list.exec(sbul);
                if (m) {
                    bullet = m[1] + (parseInt(m[2]) + 1) + '.';
                } else {
                    bullet = '1.';
                }
                //console.log('BLLTS',pid,sibling,sbul,m,bullet);
            } else {
                var prev = this.get(pid + '.pp'),
                    prev_bullet = this.get(prev + '.bc'),
                    prev_atts = this.getParagraphAtts(prev),
                    indent = atts.indent_ || '0',
                    prev_indent = prev_atts.indent_ || '0';
                if (indent > prev_indent && re_list.test(prev_bullet)) {
                    bullet = prev_bullet + '1.';
                } else {
                    bullet = '1.';
                }
                //console.log('BLLTP',pid,prev,pbul,bullet);
            }
            break;
        default: // celebrate the invention
        }
        if (papyrus.DEBUG) console.log('rebulletize(', pid, ') ', old_bullet, '-->' , bullet);
        if (force_recalc || bullet !== old_bullet) {
            this.set(pid + '.bc', bullet);
            var next_pid = this.get(pid + '.pn'),
                next_sibling_pid = this.getSiblingPid(pid);
            if (next_pid) {
                this.rebulletize(next_pid);
            }
            if (next_sibling_pid && next_sibling_pid !== next_pid) {
                this.rebulletize(next_sibling_pid);
            }
        }
    }
    Doc._p.rebulletize = rebulletize;

    function plantPoints(spec, value, src, oldval) {
        var self = this;
        var toks = spcf.split(spec);
        if (toks.length !== 2 || toks[1] !== '.at') {
            throw new Error("malformed attribute specifier " + spec);
        }
        var id = toks[0];
        function visitTraps(val, fn) {
            var m = re_at.exec(val);
            if (!m) { throw new Error('.at format violation: ' + val); }

            if (m[1]) {
                self.walkTraps(m[1], id, fn);
            } else if (m[2]) {
                self.walkTraps(m[2], id, fn);
            } /* else {
             // manual traps, i.e. URI parsing
             }*/
            self.walkParagraphs(m[2] || '', function (pid) {
                self.reset(pid + '.pw');
            });
        }
        if (oldval) { visitTraps(oldval, spcf.rm); }
        if (value) { visitTraps(value, spcf.add); }
    }

    function setupAuthorAttribute(spec) {
        if ('!@.' !== spcf.pattern(spec)) { return; }

        var uid = spcf.get(spec, '@');
        if (uid) {
            this.set(uid + '.at', 'au=\'' + uid + '\''); // technical
            this.set('=' + uid.substr(1) + '.at', 'rmau=\'' + uid + '\'');
        }
    }

    // MODEL EXTENSION

    Doc.buildDocTitleOrDefault = function (title) {
        return title || 'Живое письмо';
    };

    Doc._p.getTitle = function () {
        return Doc.buildDocTitleOrDefault(this.get('.dt'));
    };

    Doc._p.setTitle = function (title) {
        this.set('!00.dt', title);
    };

    Doc._p.getDocInfo = function () {
        var doc = this;
        return {
            id: doc.spec,
            title: doc.get('.dt') || "Живое письмо",
            url: papyrus.getUriBySpec(doc.spec),
            selected: true
        };
    };

    //  C A R D:  M E T A  &  T E X T

    Doc._p.getNextPos = function (spec, isPrev) {
        var doc = this;
        spec = spec || doc.get('.se');
        var pid;
        var pos = spcf.get(spec, ':');
        if (!pos) {
            pos = ':03+02';
            pid = ';03+02';
        } else {
            pid = spcf.get(spec, ';');
        }
        var ids = doc.get(pid + '.id');
        var off = id4.offset(ids, pos);
        if (off === -1 && isPrev) {
            var pp = doc.get(pid + '.pp');
            if (!pp) {
                return spec;
            }
            var ppids = doc.get(pp + '.id');
            var last_off = ppids.length >> 2;
            if (!last_off) {
                return pp + pp.replace(';', ':');
            }
            return pp + id4.at(ppids, last_off - 1);
        }
        if (off === -1 && ids.length) {
            return pid + id4.at(ids, 0);
        }
        if (off === 0 && isPrev) {
            return pid + pid.replace(';', ':');
        }
        if (off === (ids.length >> 2) - 1 && !isPrev) {
            var pn = this.get(pid + '.pn');
            return !pn ? '' : pn + pn.replace(';', ':');
        }
        off += isPrev ? -1 : 1;
        return pid + id4.at(ids, off);
    };

    //noinspection JSLint
    var re_b = /.+?([,\.;:'"!\?\s\-\\\/]+)/g;

    Doc._p.getNextWordPos = function (spec, isPrev) {
        var doc = this;
        var pid = spcf.get(spec, ';');
        var pos = spcf.get(spec, ':');
        var text = doc.get(pid + '.pt');
        var ids = doc.get(pid + '.id');
        var off = id4.offset(ids, pos) + 1;
        if ((off === 0 && isPrev) || (off === text.length && !isPrev)) {
            return doc.getNextPos(spec, isPrev);
        }
        if (isPrev) {
            //noinspection JSLint
            text = text.match(/./g).reverse().join('');
            off = text.length - off;
        }
        re_b.lastIndex = off;
        var m = re_b.exec(text);
        off = m ? re_b.lastIndex - m[1].length : text.length;
        if (isPrev) {
            off = text.length - off;
        }
        var id = off ? id4.at(ids, off - 1) : pid.replace(';', ':');
        return pid + id;
    };

    Doc._p.walkParagraphs = function (spec, cb) {
        var pids = spcf.filter(spec, ';');
        if (!pids.length) { return; }

        var fromp, tillp, p;
        for (p = pids[0]; p; p = this.get(p + '.pn')) {
            if (pids.indexOf(p) !== -1) {
                tillp = p;
            }
        }
        for (p = pids[0]; p; p = this.get(p + '.pp')) {
            if (pids.indexOf(p) !== -1) {
                fromp = p;
            }
        }
        for (p = fromp; true; p = this.get(p + '.pn')) {
            cb.call(this,p);
            if (p == tillp) { break; }
        }
    };

    /** returns de-facto range walked (may differ from the spec due to correction/reordering) */
    Doc._p.walkRange = function (spec, cb, newlines) { // evil :(
        var doc = this;
        newlines = newlines || false;
        var pos = spcf.get(spec, ':');
        var hint = spcf.get(spec, ';');
        var last = spcf.get(spec, ':', pos);
        var lhint = spcf.get(spec, ';', hint) || hint;
        var i = new WIter(doc, pos, hint);
        var t, tmp, o, ret;
        if (!i.match) { throw new Error('range start not found ' + spec); }

        if (!last) {
            o = i.parse();
            cb(pos, o.symb, o.id, hint, o);
            return hint + pos;
        }
        var j = new WIter(doc, last, lhint);
        if (!j.match) { throw new Error('range end not found ' + spec); }

        if (i.getWeaveOffset() > j.getWeaveOffset()) {
            t = i;
            i = j;
            j = t;
            tmp = pos;
            pos = last;
            last = tmp;
        }
        ret = i.pid + pos + j.pid + last;
        do {
            i.next();
            if (!i.match) { throw new Error('abrupt EOF'); }

            o = i.parse();
            var state = doc.getSymbolState(o);

            if (newlines?state.effective:state.visible)
                cb(o.pos, o.symb, o.id, i.pid, o);
        } while (o.pos != last);
        return ret;
    };

    Doc._p.findVisiblePosition = function (spec) {
        var doc = this;
        var pos = spcf.get(spec, ':');
        var pid = spcf.get(spec, ';');
        var it = new WIter(doc, pos, pid);
        if (!it.match) {//not found in specified paragraph
            //throw new Error('specified position not found: ' + spec);
            return ';03+02';
        }

        var p = it.parse();
        if (doc.getSymbolState(p).visible || p.symb === '\n')
            return spec;// it is OK; FIXME \n

        //invisible
        var parBegin = p.pid + spcf.parse(p.pid).token.replace(';', ':');
        var till = spcf.getParsed(spec, ':');
        it.next(0); //move to current paragraph begin
        var lastVisible = null;
        while (it.next()) {
            p = it.parse();
            if (p.id4 === till.id4) { break; }
            if (doc.getSymbolState(p).visible)
                lastVisible = it.pid + it.pos;
        }
        return lastVisible || parBegin;
    };

    Doc._p.insertText = function (spec, text) {
        var doc = this;
        var pos = spcf.get(spec, ':');
        var par = spcf.get(spec, ';');
        if (!pos) { throw new Error('no position'); }

        //ensure that last paragraph always empty
        if (par && !doc.has(par + '.pn')) {
            var idstr = doc.get(par + '.id');
            var last_pos = id4.at(idstr, (idstr.length >> 2) - 1);
            doc.set('!00' + par + last_pos + '.in', '\n');
        }
        doc.ins = doc.set('!00' + par + pos + '.in', text);
        return par + pos;
    };

    Doc._p.removeText = function (spec) { //TODO old code? remove it
        var doc = this;
        doc.walkRange(spec, function (pos) {
            doc.set('!00' + pos + '.rm');
        }, true);
    };

    Doc._p.addCSS = function (range_spec, css_att, css_val) {
        this.set('!00.at', range_spec + '\t' + css_att + ':' + css_val);
    };

    Doc._p.addClass = function (range_spec, class_name, is_on) {
        this.set('!00.at', range_spec + '\t' + class_name + '+' + (is_on ? 'on' : ''));
    };

    Doc._p.addAttribute = function (range_spec, att, val) {
        this.set('!00.at', range_spec + '\t' + att + '=' + (val || ''));
    };

    // addComment (text, range) -> id   !id.at ;p;p :p:p  comment_on :):):):)
    //     !id.ca  ;pid:range:range text
    //     ;pid.cc !id!id!id
    // highlightComment (id) -> ?unset traps, ?set traps   
    //     #co.at ;p;p :p:p hili_on
    // highlightComment () ->  #co.at ''
    // deleteCommect(id)   // edit .cc
    //     !id.cr  !id
    // getComments(pid?)  // scan pids, collect all

    // adds a comment to a range of text (selection, by default)
    Doc._p.addComment = function aC (text,sel) {
        sel = sel || this.get('.se');
        return this.set('!00.ca',sel+' '+text.replace(/\s/g,' '));
    };
    function listComment (spec, val) {
        var id = spcf.get(spec, '!'),
            comment = this.get(id + '.ca');
        if (!comment) return;

        var i = comment.indexOf(' ');
        if (i == -1) return;

        var range = spcf.split(comment.substr(0, i)),
            pid = spcf.get(range, ';'),
            key = pid + '.cc',
            ex = this.get(key) || '';
        this.set(key, ex + id);
    }
    papyrus.addFilter('.ca', listComment);

    // remove a comment by its id
    Doc._p.removeComment = function dC (spec) {
        var id = spcf.get(spec,'!');
        return id && this.set('!00.cr',id);
    };

    function unlistComment(spec, val) {
        var id = spcf.get(val, '!'),
            comment = this.get(id + '.ca');
        if (!comment) return;

        var i = comment.indexOf(' ');
        if (i == -1) return;

        var range = spcf.split(comment.substr(0,i)),
            pid = spcf.get(range, ';'),
            key = pid + '.cc',
            ex = this.get(key) || '';
        this.set(key, spcf.rm(ex, id));
    }
    papyrus.addFilter('.cr', unlistComment);

    // returns an array of comment ids for a given paragraph
    Doc._p.getParagraphComments = function (spec) {
        var id = spcf.get(spec, ';'),
            key = id + '.cc';
        return spcf.split(this.get(key) || '');
    };
    // returns an array [!id1,!id2] of active comments
    Doc._p.getComments = function () {
        var ret = [];
        for(var p=';03+02'; p; p=this.get(p+'.pn')) {
            var c = this.getParagraphComments(p);
            if (c.length)
                ret = ret.concat(c);
        }
        return ret;
    };
    // returns comment's text by its !id
    Doc._p.getCommentText = function (spec) {
        var id = spcf.get(spec, '!'),
            comment = this.get(id + '.ca');
        if (!comment) return undefined;

        var i = comment.indexOf(' ');
        if (i == -1) return undefined;

        var text = comment.substr(i + 1);
        return text;
    };
    // highlights a comment by its !id (CSS class comment_on)
    Doc._p.highlightComment = function (spec) {
        if (!spec) {
            doc.set('#co.at','comment_on');
            return;
        }
        var id = spcf.get(spec,'!'),
            comment = this.get(id + '.ca');
        if (!comment) return;

        var i = comment.indexOf(' ');
        if (i == -1) return;

        var range = spcf.split(comment.substr(0, i));
            //never used: text = comment.substr(i+1);
        if (spcf.pattern(range) !== ';:;:') return;

        var from_p = range[0],
            from = range[1],
            till_p = range[2],
            till = range[3];
        doc.set('#co.at', from + till + ' ' + from_p + till_p + ' comment_on');
    };


    Doc._p.getAntiOperations = function (sv) {
        var serial = spcf.get(sv.spec, '!');
        var res = [];
        switch (spcf.type(sv.spec)) {
        case '.in':
            var pid;
            if ('\n' === sv.val.charAt(0)) {
                pid = spcf.parse(serial.toString());
                pid.quant = ';';
                pid = pid.toString();
            } else {
                pid = spcf.get(sv.spec, ';');
            }
            var valTokens = [pid];//paragraph
            var nextId = spcf.parse(serial);
            nextId.quant = ':';
            var i, len;
            for (i = 0, len = sv.val.length; i < len; i++) {
                valTokens.push(nextId.toString());//symbols to remove
                nextId = spcf.tokinc(nextId);
            }
            res.push({spec: '!00.rm', val: valTokens.join('')});
            break;

        case '.rm':
            res.push({spec: '!00.ud', val: sv.val});
            break;

        case '.ud':
            res.push({spec: '!00.rm', val: sv.val});
            break;

        case '.at':
            var specPattern = spcf.pattern(sv.spec);
            if ('!.' === specPattern) {
                // !id.at       :from:till ;par  font-style:italic
                // !id.at       :from:till ;par  enum-class_val
                // !id.at       :from:till ;par  switch-class_on
                // !id.at       :from:till ;par  attr=value
                if (!sv.val) { break; }

                re_at.lastIndex = 0;
                var m = re_at.exec(sv.val);
                if (!m) { break; }

                if (m[5] && m[3] !== 'text-align') { //if attribute is being set
                    res.push({
                        spec: '!00.at',
                        val: (m[1] || '') + ' ' + (m[2] || '') + ' ' + m[3] + m[4]
                    });
                } /*else {
                    TODO how to restore formatting ???
                }*/
                // do not rollback
                // #ur+id.at    href="http://somewhere.org"
                // #kw.at       keyword+on
                // #tm.at       :from:till ;par key:val
                // @uid.at      au='uid'
            }
            break;
        }
        return res;
    };

    // ## Compound <p> refactoring
    // 1 metaMap { class_ : value }
    // 2 SpanChainHTML() etc +=> paragraphHTML
    // 3 indent, bullet blocks
    // 4 count up (eq list_1, indent_x)


    Doc._p.metaStack2Map = function (meta_on,version) {
        meta_on = spcf.split(meta_on);
        meta_on.sort().reverse();
        var id, ret = {};
        var ssnmap = version ? spcf.ssnMap(version) : null;

        while (id = meta_on.pop()) {
            
            if (ssnmap && id.charAt(0)==='!') {
                var vid = spcf.parse(id);
                if (vid.seq > (ssnmap[vid.ssn]||'00'))
                    continue;
            }

            // !id.at       :from:till ;par  font-style:italic
            // #ur+id.at    href="http://somewhere.org"
            // @uid.at      au='uid'
            // #kw.at       keyword+on
            var fmtspec = id + '.at';
            var fmtrec = this.get(fmtspec);
            if (!fmtrec) {
                if (fmtspec.charAt(0) === '=') {
                    var uid = '@' + spcf.get(fmtspec, '=').substr(1);
                    fmtrec = 'rmau=\'' + uid + '\'';
                    this.set(fmtspec, fmtrec);
                } else {
                    continue;
                }
            }

            var m = re_at.exec(fmtrec);
            if (!m) { continue; } //FIXME strange
            // m[1] and m[2] is the range so we skip it
            var fmtKey = m[3], fmtValue = m[5], key_ = m[3]+m[4];

            var format = meta_allowed[key_], ok = false;
            switch (typeof(format)) {
                case 'undefined': ok = false; break;
                case 'string':    ok = !format || !fmtValue || fmtValue===format; break;
                case 'object':    ok = format.test(fmtValue); break;
                default:          ok = false; break;
            }
            if (!ok) {
                console.error('meta not allowed: ', fmtrec);
                continue;
            }

            ret[key_] = fmtValue;

        }

        return ret;
    };

    Doc._p.meta2atts = function (meta_on,version) {
        var ret = [], atts = {}, classes = {}, styles = {}, some;

        var meta = meta_on.constructor===String ? 
            this.metaStack2Map(meta_on,version) :
            meta_on;

        for(var key in meta) {
            var quant = key.substr(-1),
                name = key.substr(0, key.length - 1);
            switch (quant) {
                case '_': some = classes; break;
                case ':': some = styles; break;
                case '=': some = atts; break;
            }
            meta[key]? some[name]=meta[key] : delete some[name]; // I dont understand 28Jan14
        }
        // TODO: hili reformatted text   :) still open - Jan14

        ret.push(" class='");
        for (var c in classes)
            ret.push(c, classes[c]==='true' ? '' : '_'+classes[c], ' ');
        ret.pop()===' ' && ret.push("'");

        ret.push(" style='");
        for (var s in styles)
            ret.push(s, ':', styles[s], ';');
        ret.pop()===';' && ret.push("'");

        for (var a in atts)
            ret.push(' ', a, '=', atts[a]);

        return ret.join('');
    };

    // TODO: use specs, i.e.  au='@us+er'
    Doc._p.getHiliCSS = function () {
        var doc = this;
        var colors = papyrus.palette ? doc.getUserPaletteColors() : doc.getUserHashColors();
        colors['@00'] = ['transparent', '000'];
        var css = [];
        var uid;
        for (uid in colors) {
            css.push("[au='", uid, "'] { border-color: ", colors[uid][0], "; }\n");
            css.push("[au='", uid, "'].bg { background-color: ", colors[uid][0], "; color: " + colors[uid][1] + "; }\n");
            css.push("[rmau='", uid, "']:before { border-bottom-color: ", colors[uid][0], " !important; }\n");
        }
        return css.join('');
    };

    Doc._p.getHTML = function () {
        var html = [];
        var pid;
        this.renderPendingParagraphs();
        for (pid = ';03+02'; pid; pid = this.state[pid + '.pn']) {
            html.push(this.getParagraphHTML(pid, true));
        }
        return html.join('\n');
    };

    Doc._p.getText = function () {
        var text = []; //[String.fromCharCode(0xEF,0xBB,0xBF)]; // UTF-8 BOM
        var pid;
        this.renderPendingParagraphs();
        for (pid = ';03+02'; pid; pid = this.get(pid + '.pn')) {
            var atts = this.getParagraphAtts(pid);
            switch (atts.list_) {
            case 'v':
                text.push('[' + (atts.check_ ? 'x' : ' ') + '] ');
                break;
            case 'o':
                text.push('* ');
                break;
            case '1':
                text.push(this.get(pid + '.bc') + ' ');
                break;
            }
            text.push(this.get(pid + '.pt'), '\r\n');
        }
        return text.join('');
    };

    /** @see doc-media.js */
    Doc._p.getMediaBlockHtml = function () {
        return '';
    };

    Doc._p.getTextBlockHtml = function (pid) {
        var doc = this;
        //var atts = doc.get(pid + '.pA');
        var html = doc.get(pid + '.ph');
        var p_html = ['<p id=\'', doc.elementPrefix || '', pid, '\'', '>', html, '</p>'];
        return p_html.join('');
    };

    Doc._p.getParagraphAtts = function gPA (pid,version) {
        // TODO cache
        var srcatt = this.get(pid+'.tr');
        return this.metaStack2Map(srcatt,version);
    };

    Doc._p.checkCounters = function (pid) {
        var myAtts = this.getParagraphAtts(pid), myIndent=myAtts.indent_;
        var atts={}, p1=pid;
        for(var p=pid; p; p=this.get(p+'.pp')) {
            atts = this.getParagraphAtts(p);
            if (atts.indent_<myIndent)
                break;
            if (atts.indent_==myIndent && atts.list_!='1')
                break;
            if (atts.indent_==myIndent)
                p1 = p;
        }
        var prefix = p&&atts.list_==='1' ? this.get(p+'.bc') : '', n=1;
        for(var cp=p1; cp; cp=this.get(cp+'.pp')) {
            atts = this.getParagraphAtts(cp);
            if (atts.indent_<myIndent || atts.list_!='1')
                break;
            if (atts.indent_!=myIndent)
                continue;
            counter = prefix + (n++) + '.';
            if (counter!==this.get(cp+'.bc'))
                this.set(cp+'.bc',counter);
        }
    };

    Doc._p.getBulletBlockHtml = function (pid) {
        var bullet = this.get(pid + '.bc') || '&nbsp;';
        //if (bullet===undefined || bullet===null) bullet = '&nbsp;';
        return "<div class='bulletbox'>"+bullet+"</div>";
    };

    Doc._p.getCloudBlockHtml = function (pid) {
        return '';
    };

    Doc._p.getFooterBlockHtml = function (pid) {
        return '';
    };

    Doc._p.getParagraphHTML = function (pid, forExport) {
        var doc = this;
        var atts = doc.getParagraphAtts(pid);
        atts.pbox_ = 'true';
        atts.media_ = 'true';
        var attstr = doc.meta2atts(atts);
        var media = doc.getMediaBlockHtml(pid, forExport);
        var bullet = doc.getBulletBlockHtml(pid);
        var text = doc.getTextBlockHtml(pid);
        var cloud = doc.getCloudBlockHtml(pid);
        var footer = doc.getFooterBlockHtml(pid);
        return ['<div ' + attstr + '>',
                    media,
                    '<div class="textbox">',
                        bullet,
                        text,
                        cloud,
                    '</div>',
                    footer,
                '</div>'].join('');
    };

    Doc._p.getExportHTML = function (spec, print) {
        // 23.10
        var self = this;
        //TODO fixme getHTML have no params
        var html_body = self.getHTML(spec);
        //noinspection JSLint
        html_body = html_body.replace(
            /<span id='([^']+)'[^>]+class='[^']*uri_on[^>]+>[^<]*<\/span>/g,
            function (match, id) {
                var href = self.get(id + '.go');
                if (!href) { return match; }

                href = esc.htmlesc(href);
                return '<a href=\'' + href + '\'>' + match + '</a>';
            }
        );

        //noinspection JSLint
        html_body = html_body.replace(/<span id='([^']{2})*'/mg, "<span id=''");
        var css_text = self.getHiliCSS();
        var print_js = '';
        if (print) {
            print_js = '<script>window.onload = function(){window.print()}</script>';
        }
        //noinspection JSLint
        return '<html>\n\t<head>\n' +
            '\t\t<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n' +
            '\t\t<link type="text/css" href="http://ppyr.us:8888/public/web/editor.css"' +
            ' rel="stylesheet">\n' +
            '\t\t<style type="text/css">\n' + css_text + '\n\t\t</style>\n' +
            print_js +
            '\t</head>\n\t<body>\n' +
            html_body.replace(/^<p id='[^']+'/g, '\t\t<p ') +
            '\n\t</body>\n</html>\n';
    };

    function split_regex(till) {
        var _any = "[0-\u8030]";
        var _ltr = "(?:.|\\n)";
        var _0 = till.charCodeAt(0);
        var _1 = till.charCodeAt(1);
        function inscode(c) {
            return esc.regesc(String.fromCharCode(c));
        }
        var ret = [];
        ret.push("((?:");
        if (_0 > 0x30) {
            ret.push(_ltr, "[0-", inscode(_0 - 1), ']', _any, "{3}", '|');
        }
        ret.push(_ltr, inscode(_0), "[0-", inscode(_1), ']', _any, "{2}");
        ret.push(")+)|((?:");
        if (_1 < 0x8030) {
            ret.push(_ltr, inscode(_0), '[', inscode(_1 + 1), '-', '\u8030', ']', _any, "{2}", '|');
        }
        ret.push(_ltr, '[', inscode(_0 + 1), '-', '\u8030', ']', _any, "{3}");
        ret.push(")+)");
        return new RegExp(ret.join(''), "mg");
    }

    /** Returns a historical state of the doc as another Doc object.
     *  The snapshot is NOT fully-functional, can only produce the text;
     *  not editable, no admin info. */
    Doc._p.getSnapshot = function (vid) {
        //console.error('snap');
        var doc = this;
        var weave = [];
        var m;
        var show_version = spcf.getParsed(vid, '*') || { seq: doc.get('.MX').substr(1) };
        var limseq = show_version.seq;
        var version = '!' + limseq;
        var pid;
        for (pid = ';03+02'; pid; pid = doc.state[pid + '.pn']) {
            weave.push(this.state[pid + '.pw']);
        }
        weave = weave.join('');
        //console.error('composed a joined weave',weave.length);
        var split_re = split_regex(limseq);
        var weavestr = weave.replace(split_re, "$1");
        //console.error('filtered weave',weavestr.length);
        spcf.re_weavelet_g.lastIndex = 0;
        var snapshot = new Doc(doc.spec, {storage: new papyrus.NoStorage()});
        var state = snapshot.state;
        var letgo = '#@';
        var spec;
        for (spec in this.state) {
            if (spec.charAt(0) === '!') {
                if (spcf.get(spec, '!') <= version) {
                    state[spec] = this.state[spec];
                }
            } else if (spec.indexOf('.tr') > -1) {
                var list = spcf.split(this.state[spec]).reverse();
                var res = [];
                var tok;
                //noinspection JSLint
                while (tok = list.pop()) {
                    if (tok.charAt(0) === '!' && tok <= vid) {
                        res.push(tok);
                    }
                }
                state[spec] = res.join('');
            } else if (letgo.indexOf(spec.charAt(0)) > -1) {
                state[spec] = this.state[spec];
            } else if (spec.charAt(0) === ';') { // various paragraph attributes
                pid = '!' + spcf.get(spec, ';').substr(1);
                if (pid <= version) {
                    state[spec] = this.state[spec];
                }
            }
        }

        var prev_pid = null;
        //noinspection JSLint
        while (m = spcf.re_weavelet_g.exec(weavestr)) {
            pid = ';' + m[1] + '+' + m[2];
            state[pid + '.pw'] = m[0];
            if (prev_pid) {
                state[prev_pid + '.pn'] = pid;
                state[pid + '.pp'] = prev_pid;
            }
            prev_pid = pid;
            //console.error('weavelet',m[0].length);
        }

        state['.ok'] = this.state['.ok'];

        //build version vector
        var base_version = spcf.get(vid, '!');
        base_version || (base_version = '!00');
        var base_seq = spcf.parse(base_version).seq;
        base_version = '';
        for (var ssn in spcf.ssnMap(doc.state['.SN'] || '')) {
            base_version += '$' + base_seq + '+' + ssn;
        }
        snapshot.set('.BV', base_version);
        snapshot.set('.RL', 'true');
        for (pid = ';03+02'; pid; pid = state[pid + '.pn']) {
            snapshot.reset(pid + '.pw');
        }
        for (pid = ';03+02'; pid; pid = state[pid + '.pn']) { //TODO fix shame
            snapshot.reset(pid + '.pw');
        }
        snapshot.renderPendingParagraphs();
        return snapshot;
    };

    //  H T M L  R E N D E R I N G

    // TODO: per-paragraph formatting
    //  ;par.pa!10+02   head1+on
    //  ;par.al         !10+02
    //  ;par.pA         class='head'
    //  also:  inbr attribute for hili line breaks

    Doc._p.renderPendingParagraphs = function () {
        var doc = this;
        var paragraphsToRender = doc.get('.PP') || '';
        if (!paragraphsToRender) { return; }

        var pidList = spcf.split(paragraphsToRender);
        if (papyrus.DEBUG) { console.log('renderPendingParagraphs', pidList.length); }
        var i, l;
        for (i = 0, l = pidList.length; i < l; i++) { doc.renderParagraph(pidList[i]); }

        //some paragraphs might need to be rerendered
        //- uri parsing detected some uris
        //- paragraph main author changed
        doc.renderPendingParagraphs();
    };

    Doc._p.flipRedlining = function () {
        //this.set('.RL',this.get('.RL')==='true'?'':'true');
        //rerender paragraphs
        var pid;
        for (pid = ';03+02'; pid; pid = this.get(pid + '.pn')) {
            this.reset(pid + '.pw');
        }
    };

    Doc._p.setBaseVersionByCurrent = function () {
        var doc = this;
        doc.set('.BV', doc.get('.AC'));
    };

    Doc._p.setBaseVersionBySelection = function () {
        var doc = this;
        var sel = spcf.split(doc.get('.se') || ';03+02:03+02');
        var max = {};
        //determine max seq by ssn
        doc.walkRange(sel, function (pos, symb, id, pid, parsed) {
            if (parsed.lead === '\u0008') {
                if (!max[parsed.leadssn] || max[parsed.leadssn] <= parsed.leadseq) {
                    max[parsed.leadssn] = parsed.leadseq;
                }
            } else if (!max[parsed.ssn] || max[parsed.ssn] <= parsed.seq) {
                max[parsed.ssn] = parsed.seq;
            }
        }, true);
        //override elements in base-version
        var base = spcf.ssnMap(doc.get('.BV'));
        var ssn;
        for (ssn in max) {
            base[ssn] = max[ssn];
        }
        var baseStr = [];
        for (ssn in base) {
            baseStr.push('$' + base[ssn] + (ssn === '00' ? '' : ('+' + ssn)));
        }
        doc.set('.BV', baseStr.join(''));
    };

    function cacheBaseVersion() {
        this.base = spcf.ssnMap(this.get('.BV') || '');
        this.redliningOn = (this.get('.RL')==='true');
        if (papyrus.DEBUG) { console.log('BASE',this.base,'REDL',this.redliningOn); }
    }
    papyrus.addFilter('.BV', cacheBaseVersion);
    papyrus.addFilter('.RL', cacheBaseVersion);
    papyrus.addFilter('.ok', cacheBaseVersion);

    Doc._p.getSymbolState = function (atom) {
        var base = this.base || spcf.ssnMap(this.get('.BV') || ''); // this can only be fixed in Swarm
        var ret = {
            atom:    atom,
            visible: true,
            effective: true,
            removed: false,
            added:   !this.redliningOn || atom.seq > (base[atom.ssn]||'00'),
            notyet:  false, // TODO
            author:  this.get('!' + atom.ssn + '.sn'),
            rm_author: null
        };
        // TODO version => strip meta
        if (atom.lead === '\u0008') { // there is a delete
            ret.removed = true;
            ret.rm_author = '=' + this.get('!' + atom.leadssn + '.sn').substr(1); // TODO
            if (this.redliningOn && atom.seq <= (base[atom.ssn]||'00')) { // is it a newly removed symbol
                ret.effective = atom.leadseq > (base[atom.leadssn] || '00');
            } else {
                ret.effective = false;
            }
        }
        ret.visible = ret.effective && atom.symb !== '\n';
        return ret;
    };

    Doc._p.renderParagraph = function (spec) {
        var doc = this;
        var pid = spcf.get(spec, ';');
        var prev_pid = doc.get(pid + '.pp');
        var next_pid = doc.get(pid + '.pn');
        var meta_in = doc.get(prev_pid + '.mo');
        var meta_on = meta_in;

        var offColorUsers = spcf.split(doc.get('.UC') || '');

        doc.state['@00.at'] = 'au=\'@00\'';
        doc.state['#sc.at'] = 's_c';
        doc.state['#sa.at'] = 's_a';
        doc.state['#rm.at'] = 'rm_on';
        doc.state['#na.at'] = 'noauthor_on';

        var html = [];
        var text = [];
        var ids = [];
        var span = [];
        var aurmnw = '';
        var uid_2_symbols_count = {}; // for author color line
        var uid_all_symbols_count = {}; // for contribution count
        var major_author = null;
        var authors_count = 0;
        var i = new WIter(doc, null, pid);

        // TODO ver above => return
        function flush() {
            if (span.length) {
                html.push(span.join(''), '</span>');
                span = [];
            }
        }

        while (i.match && i.pid === pid) {
            var mol = i.parse();
            var state = this.getSymbolState(mol);
            var uid = state.author;
            var stateatts =
                    '#sc' + 
                    ((state.removed && '#rm' + state.rm_author) || '') +
                    ((!state.added && !state.removed && '#ol') || '') +
                    state.author +
                    ((offColorUsers.indexOf(state.author) > -1 && '#na') || '');
            
            if (state.effective) {
                if (!uid_2_symbols_count[uid]) {
                    authors_count++;
                    uid_2_symbols_count[uid] = 1;
                } else {
                    uid_2_symbols_count[uid]++;
                }
                if (!major_author || uid_2_symbols_count[major_author] <= uid_2_symbols_count[uid]) {
                    major_author = uid;
                }
            }
            // считаем добавленные символы во вклад пользователя
            if (state.effective || state.removed) {
                if (!uid_all_symbols_count[uid]) {
                    uid_all_symbols_count[uid] = 1;
                } else {
                    uid_all_symbols_count[uid]++;
                }
            }
            // считаем удаление во вклад пользователя
            if (state.removed) {
                var rm_author = state.rm_author;
                rm_author = '@' + rm_author.slice(1);
                if (!uid_all_symbols_count[rm_author]) {
                    uid_all_symbols_count[rm_author] = 1;
                } else {
                    uid_all_symbols_count[rm_author]++;
                }
            }

            if (state.visible) {
                if (stateatts !== aurmnw) {
                    aurmnw = stateatts;
                    flush();
                }

                if (!span.length) {
                    var att_str = doc.meta2atts(meta_on + aurmnw);
                    span.push('<span id=\'', mol.pos, '\'', att_str, '>');
                }
                var symb_html = entities[mol.symb] || mol.symb;
                span.push(symb_html);
                text.push(mol.symb);
                ids.push(mol.id);
            }

            // set formatting
            var switch_points = doc.get(mol.pos + '.tr');
            if (switch_points) {
                var fsw = spcf.split(switch_points);
                while (fsw.length) {
                    meta_on = spcf.flip(meta_on, fsw.pop());
                }
                // TODO set/unset formatting changed #fc
                flush();
            }

            i.next();
            // TODO VER above => next()
        }
        flush();
        if (html.length === 0 && doc.get(pid + '.pw')) {
            html.push('<span>&nbsp;</span>');
        }

        if (doc.redliningOn) {
            major_author = '@00';
        }
        // paragraph formatting is better kept separately
        var p_format = doc.get(pid + '.tr') || '';
        var p_format_old = p_format;
        var old_ma = spcf.get(p_format, '@');
        if (major_author) {
            if (old_ma !== major_author) {
                p_format = old_ma ? spcf.replace(p_format, old_ma, major_author).toString() : p_format + major_author;
            }
            if (offColorUsers.indexOf(major_author) > -1 &&
                    (p_format.indexOf('#na') === -1 || authors_count > 1)) {
                p_format += '#na';
            } else if (offColorUsers.indexOf(major_author) === -1 &&
                    p_format.indexOf('#na') > -1 &&
                    (authors_count === 1 || !offColorUsers)) {
                p_format = spcf.replace(p_format, '#na', '').toString();
            }
        }
        if (p_format !== p_format_old) {
            doc.set(pid + '.tr', p_format);
        }
        if (next_pid) {
            var next_pform = doc.get(next_pid + '.tr');
            var next_author = spcf.get(next_pform, '@');
            if (next_author != major_author) { p_format += '#sa'; }
        }
        var old_p_attrs = doc.get(pid + '.pA');
        var p_attrs = doc.meta2atts(p_format);
        if (old_p_attrs != p_attrs) {
            doc.set(pid + '.pA', p_attrs);
        }

        //remove paragraph from paragraphs waiting for rendering
        doc.set( '.PP', spcf.rm(doc.get('.PP')||'', pid) );

        html = html.join('');
        if (!doc.redliningOn && major_author) {
            if (!offColorUsers.length ||
                    (offColorUsers.indexOf(major_author) === -1 && authors_count === 1)) {
                html = html.replace(new RegExp('au=\'' + major_author + '\'', 'g'), 'au=\'@00\'');
            }
        }
        doc.set(pid + '.id', ids.join(''));
        doc.set(pid + '.pt', text.join('')); //triggers async rerenders
        doc.set(pid + '.ph', html);
        doc.set(pid + '.mo', meta_on);
        doc.set(pid + '.mi', meta_in);
        for (uid in uid_all_symbols_count) {
            doc.set(uid + pid + '.tc', uid_all_symbols_count[uid]);
        }

    };

    Doc._p.walkTraps = function wT(locs, id, fn) {
        if (locs.length === 0) { return; }
        var self = this;
        var walk = spcf.split(locs);
        var tok;
        //noinspection JSLint
        while (tok = walk.pop()) {
            var trap_sp = tok + '.tr';
            var ex_val = self.get(trap_sp);
            var val = fn(ex_val, id);
            self.set(trap_sp, val);
        }
    };

    Doc._p.getUserPaletteColors = function () {
        var doc = this;
        var userlist = spcf.as(doc.get('.UL'));
        var ret = {};
        var i;
        for (i = 0; i < userlist.length; i++) {
            var uid = userlist[i];
            if (i < papyrus.palette.length) {
                ret[uid] = papyrus.palette[i];
            } else {
                var color_index = i % papyrus.palette.length;
                var color = parseInt(papyrus.palette[color_index][0], 16);
                var r = color >> 16;
                var g = (color >> 8) & 0xff;
                var b = color & 0xff;
                var decay = (i / papyrus.palette.length) & 3;
                r >>= decay;
                g >>= decay;
                b >>= decay;
                var rgb = (r << 16) | (g << 8) | b;
                var shaded = rgb.toString(16);
                while (shaded.length < 6) { shaded = '0' + shaded; }
                ret[uid] = [shaded, papyrus.palette[color_index][1]];
            }
        }
        return ret;
    };

    function pseudoHashCode(str) {
        var hash = 0;
        if (str.length === 0) { return 0; }

        if (str.length < 4) {
            str = str + '+' + str;
        }
        var i;
        for (i = 0; i < str.length; i++) {
            var chr = str.charCodeAt(i);
            hash = (((hash << 5) - hash) + chr) & 0x7fffffff;
        }
        return hash;
    }

    function hsv2cssrgb(hue, sat, vol) {
        var the_s = sat || 1;
        var the_v = vol || 1;
        var the_c = the_v * the_s;
        var the_m = the_v - the_c;
        var h1 = hue * 360 / 60;
        var x = the_c * (1.0 - Math.abs(h1 % 2 - 1.0));
        var r, g, b;
        switch (Math.floor(h1)) {
        case 0:
            r = the_c;
            g = x;
            b = 0;
            break;
        case 1:
            r = x;
            g = the_c;
            b = 0;
            break;
        case 2:
            r = 0;
            g = the_c;
            b = x;
            break;
        case 3:
            r = 0;
            g = x;
            b = the_c;
            break;
        case 4:
            r = x;
            g = 0;
            b = the_c;
            break;
        case 5:
            r = the_c;
            g = 0;
            b = x;
            break;
        default:
            r = g = b = 0;
        }
        r += the_m;
        g += the_m;
        b += the_m;
        r = Math.floor(r * 0xff);
        g = Math.floor(g * 0xff);
        b = Math.floor(b * 0xff);
        var rs = r.toString(16);
        var gs = g.toString(16);
        var bs = b.toString(16);
        if (rs.length < 2) { rs = '0' + rs; }
        if (gs.length < 2) { gs = '0' + gs; }
        if (bs.length < 2) { bs = '0' + bs; }
        return rs + gs + bs;
    }

    Doc._p.getUserHashColors = function () {
        var s_min = 0.2, s_max = 0.5, s_span = s_max - s_min;
        var v_min = 0.3, v_max = 0.7, v_span = v_max - v_min;
        var hues = {}, bins = [], ret = {"00": ["#000", "#fff"]};
        var userlist = spcf.as(this.get('.UL'));
        var h;
        var uid;
        //noinspection JSLint
        while (uid = userlist.pop()) {
            var hue = pseudoHashCode(uid) & 0xff;
            if (hue >= 20 && hue <= 40) {
                hue <<= 2; // no shitty colors
            }
            hues[uid] = hue / 0xff;
            h = hue >> 5;
            if (!bins[h]) { bins[h] = []; }
            bins[h].push(uid);
        }
        var b;
        for (b = 0; b < 8; b++) {
            var bin = bins[b];
            if (!bin || !bin.length) { continue; }

            bin.sort();
            var lines = Math.floor(Math.sqrt(bin.length));
            var i;
            for (i = 0; i < bin.length; i++) {
                uid = bin[i];
                var s = s_max - s_span / lines * (i % lines);
                var v = v_max - v_span / lines * Math.floor(i / lines);
                h = hues[uid];
                if (h < 0 || h > 1 || s < 0 || s > 1 || v < 0 || v > 1) {
                    console.log("oops");
                }
                ret[uid] = ['#' + hsv2cssrgb(h, s, v), '#000']; //TODO second color by V (value)
            }
        }
        return ret;
    };

    function resetParagraphs() { // TODO async
        var doc = this;
        var pid;
        for (pid = ';03+02'; pid; pid = doc.get(pid + '.pn')) {
            doc.reset(pid + '.pw');
        }
    }

    Doc._p.slowRedraw = function slowRedraw () {
        var doc = this, pids=[];
        for (var pid = ';03+02'; pid; pid = doc.get(pid + '.pn')) {
            pids.push(pid);
        }
        var ih = setInterval(function(){ 
            var p = pids.pop();
            if (p) {
                if (doc.get(p+'.pw')) { doc.renderParagraph(p); }
            } else {
                clearInterval(ih);
            }
        },1);
    };

    function emitTextChanged() {
        papyrus.emit('docTextChanged');
    }

    papyrus.addFilter('.BV', resetParagraphs);
    papyrus.addFilter('.UC', resetParagraphs);
    papyrus.addFilter('.DV', resetParagraphs);
    papyrus.addFilter('.in', insertSymbol);
    papyrus.addFilter('.rm', markSymbolDelUndel);
    papyrus.addFilter('.ud', markSymbolDelUndel);

    papyrus.addFilter('.pw', markParagraphNeedRender);
    papyrus.addFilter('.mo', recheckMarkup);
    papyrus.addFilter('.at', plantPoints);

    papyrus.addFilter('.at', bulletize);

    papyrus.addFilter(".dt", Doc._p.stripSeqMark);

    papyrus.addFilter(".dt", function (spec, title) {
        if (spcf.pattern(spec) !== '.') { return; }

        papyrus.emit('titleChanged', this, title);
    });

    papyrus.addFilter('.uj', setupAuthorAttribute);

    papyrus.addFilter('.in', emitTextChanged);
    papyrus.addFilter('.rm', emitTextChanged);
    papyrus.addFilter('.ud', emitTextChanged);

    papyrus.addFilter('.tc', function (spec, val, pipe, old_val) {
        //possible spec formats: @uid;pid.tc or @uid.tc (pid - paragraph id, uid - userid)
        var doc = this,
            uid = spcf.get(spec, '@'),
            delta = parseInt(val, 10) - parseInt(old_val || '0', 10);
        switch (spcf.pattern(spec)) {
            case '@;.': // by paragraph contribution @uid;pid.tc
                if (val !== old_val) {
                    var sp = uid + '.tc';
                    //update user total contribution
                        doc.set(sp, parseInt(doc.get(sp) || '0', 10) + delta);
                    }
                break;
            case '@.': // user total contribution @uid.tc/
            // update grand total
                doc.set('.TC', parseInt(doc.get('.TC') || '0', 10) + delta);
            break;
        }
    });

    papyrus.addFilter('.mc', function (spec, val, pipe, old_val) {
        //possible spec formats: @uid;pid.mc
        var doc = this,
            uid = spcf.get(spec, '@'),
            delta = parseInt(val, 10) - parseInt(old_val || '0', 10);
        if (val !== old_val) {
            var sp = uid + '.tc';
            //update user total contribution
            doc.set(sp, parseInt(doc.get(sp) || '0', 10) + delta);
        }
    });

    /*papyrus.on('idle', function onIdle(idle) {
        if (idle) {
            console.log("IDLE");
            var doc = window.doc;
            if (!doc) { return; }
            if (!doc.has('.DV')) {
                doc.setBaseVersionByCurrent();
            }
        }
    });*/

}(g['papyrus'] = g['papyrus'] || {}));
