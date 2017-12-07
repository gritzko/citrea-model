//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function initDocViewer(papyrus) {
    require('./doc.js');
    require('./doc-text.js');

    var KEYBOARD = papyrus.KEYBOARD;

    var isMac = papyrus.isMac;
    var isIE = papyrus.isIE;
    var ieVer = papyrus.ieVer;
    var isFirefox = papyrus.isFirefox;
    var isOpera = papyrus.isOpera;
    var isIos = papyrus.isIos;

    var spcf = papyrus.spcf;
    var id4 = papyrus.id4;
    var Doc = papyrus.Doc;

    var embed = $('body').hasClass('page-embedded');

    Doc._p.linkToDom = function l2D(body, misc) {
        this.body = body;
        this.misc = misc;
        this.elementPrefix = this.elementPrefix || this.spec;
        this.dbody = (isIE && document.documentElement) ?
                document.documentElement : document.body;
        this.viewport = document.getElementById('text-wrap');
        this.dbody.style.userSelect = 'none';
        this.dbody.style.webkitUserSelect = 'none';
        this.dbody.style.MozUserSelect = 'none';
        this.dbody.style.oUserSelect = 'none';
        this.body.style.whiteSpace = 'pre-wrap';

        this.staging = document.createElement('div');
        this.staging.style.display = 'none';
        this.misc.appendChild(this.staging);

        this.bkmark = this.stageNode(['<span id="', this.elementPrefix || '', '_bmark">&#xfeff;</span>'].join(''));
        this.misc.appendChild(this.bkmark);

        this.cursor = this.stageNode([
            '<span id="', this.elementPrefix || '', '_cursor">',
            isFirefox ? '' : '&nbsp;',
            '</span>'
        ].join(''));
        this.misc.appendChild(this.cursor);

        var cs = this.cursor.style;
        cs.display = 'block';
        cs.position = 'absolute';
        cs.width = '1px';
        cs.zIndex = 5;
        cs.backgroundColor = isIos ? 'transparent' : 'black';

        this.installDomEventListeners();

        this.drawState(this.state, this.body);

    };

    Doc._p.getScrollOffsets = function dGetScrollOffsets() {
        return {
            top: this.dbody.scrollTop + this.viewport.scrollTop,
            left: this.dbody.scrollLeft + this.viewport.scrollLeft
        };
    };

    Doc._p.drawState = function dS(state, root) {
        while (root.firstChild) {
            root.removeChild(root.firstChild);
        }
        for (var pid = ';03+02'; pid; pid = state[pid + '.pn']) {
            var p = this.createParagraphNode(pid, true);
            root.appendChild(p);
        }
    };

    Doc._p.unlinkFromDom = function uFD() {
        this.removeDomEventListeners();
        delete this.staging;
        delete this.bkmark;
        delete this.cursor;
        $(this.misc).empty();
        $(this.body).empty();
        delete this.misc;
        delete this.body;
    };

    Doc._p.showHistoricalVersion = function sHV(versn) {
        if (window.snap) { this.hideHistoricalVersion(); }
        var snap = window.snap = this.getSnapshot(versn);
        snap.elementPrefix = snap.spec + versn;
        var snapbody = document.getElementById('snapbody');
        var snapmisc = document.getElementById('snapmisc');
        this.disableEditing();
        this.body.style.display = 'none';
        snapbody.style.display = 'block';
        snap.linkToDom(snapbody, snapmisc);
    };

    Doc._p.hideHistoricalVersion = function hHV() {
        if (!window.snap) { return; }

        window.snap.unlinkFromDom();
        var snapbody = document.getElementById('snapbody');
        snapbody.style.display = 'none';
        var docbody = document.getElementById('body');
        docbody.style.display = 'block';
        delete window.snap;
    };

    Doc._p.stdMouseEv = function sME(ev) {
        var scrollOffset = this.getScrollOffsets();
        return {
            x: ev.clientX + scrollOffset.left,
            y: ev.clientY + scrollOffset.top,
            target: isIE ? ev.srcElement : ev.target
        };
    };

    Doc._p.installDomEventListeners = function iDEL() {
        this.mouseDown = false;
        this._pendingMove = null;
        this._prevMD = 0;
        this._mdCount = 0;

        var wndw = $(window);
        var body = $(this.body);
        var cursor = $(this.cursor);

        this.onMousemove = function (ev) {
            ev = ev.originalEvent;
            if (!this.mouseDown) { return; }

            if (!this._pendingMove) {
                this._pendingMove = this.stdMouseEv(ev);
                setTimeout(function () {
                    this.moveCursorXY(this._pendingMove, true);
                    this._pendingMove = null;
                }.bind(this), 100);
            } else {
                this._pendingMove = this.stdMouseEv(ev);
            }
        }.bind(this);

        this.onMousedown = function (ev) {
            ev = ev.originalEvent;
            if (isIE && ieVer < 10 && ev.button != 1) { return false; }
            //noinspection JSHint
            if ((!isIE || ieVer >= 10) && ev.button != 0) { return false; }

            this.enableInput();
            this.mouseDown = !ev.shiftKey;
            var stdev = this.stdMouseEv(ev);

            if (!this.prepare_navigation(ev)) {
                this.moveCursorXY(stdev, ev.shiftKey);
            }

            var ts = (new Date()).getTime();

            if (ts - this._prevMD < 400) {
                this._mdCount++;

                if (this._mdCount === 3) {
                    this.selectParagraph(stdev);
                } else {
                    this.selectWord(stdev);
                }
            } else {
                this._mdCount = 1;
            }

            this._prevMD = ts;

            return false; // kill native selection
        }.bind(this);

        this.onMouseup = function () {
            //ev = ev.originalEvent;
            if (!this.mouseDown) {
                this.navigate();
                return;
            }

            //this.moveCursorXY(this.stdMouseEv(ev), true);
            this.mouseDown = false;
        }.bind(this);

        //noinspection FunctionWithInconsistentReturnsJS
        this.onKeydown = function (ev) {
            ev = ev.originalEvent;
            if (this.inputDisabled) {
                return true;
            }

            if (this.has('.se')) {
                this.moveCursor(ev);
            }
        }.bind(this);

        this.onResize = function () {
            this.recoverCursor();
        }.bind(this);

        body.on("mousedown", this.onMousedown);
        cursor.on("mousedown", this.onMousedown);
        wndw.on("mouseup", this.onMouseup);
        wndw.on("mousemove", this.onMousemove);
        wndw.on("keydown", this.onKeydown);
        wndw.on("resize", this.onResize);
    };

    Doc._p.removeDomEventListeners = function rDEL() {
        this.mouseDown = false;
        this._pendingMove = null;
        this._prevMD = 0;
        this._mdCount = 0;

        var wndw = $(window);
        var body = $(this.body);
        var cursor = $(this.cursor);

        body.off("mousedown", this.onMousedown);
        cursor.off("mousedown", this.onMousedown);
        wndw.off("mouseup", this.onMouseup);
        wndw.off("mousemove", this.onMousemove);
        wndw.off("keydown", this.onKeydown);
        wndw.off("resize", this.onResize);
    };

    Doc._p.disableInput = function () {
        this.inputDisabled = true;
    };
    Doc._p.enableInput = function () {
        this.inputDisabled = false;
    };

    Doc._p.stageNode = function sN(html) {
        this.staging.innerHTML = html;
        return this.staging.firstChild;
    };

    Doc._p.findParagraphNode = function fPN(pid) {
        var id = (this.elementPrefix || '') + pid;
        return document.getElementById(id);
    };

    Doc._p.findParagraphBox = function fPN(pid) {
        var p = this.findParagraphNode(pid);
        return p && p.parentNode.parentNode; // :D
    };

    Doc._p.createParagraphNode = function cPN(pid, noMount) {
        var doc = this;
        var p_html = doc.getParagraphHTML(pid);
        var p = doc.stageNode(p_html);
        if (noMount) { return p; }

        var next_pid = doc.get(pid + '.pn');
        var next = next_pid ? doc.findParagraphBox(next_pid).nextSibling : null;
        if (next) {
            doc.body.insertBefore(p, next);
        } else {
            doc.body.appendChild(p);
        }
        return p;
    };


    Doc._p.drawCursor = function dC(rect) {
        var cs = this.cursor.style;
        if (!rect || !this.editorOn) {
            cs.display = 'none';
            return;
        }
        cs.display = 'block';
        var e;
        for (e = this.cursor.offsetParent; e && e != this.dbody; e = e.offsetParent) {
            rect.left -= e.offsetLeft;
            rect.top -= e.offsetTop;
        }
        cs.left = rect.left + 'px';
        cs.top = rect.top + 'px';
        cs.height = rect.height + 'px';
        cs.width = '1px';
        if (this.trap) {
            this.trap.style.top = this.cursor.offsetTop + "px";
            this.trap.style.height = (5 + this.cursor.offsetHeight) + 'px';
            this.trap.style.fontSize = this.cursor.offsetHeight + 'px';
            if (!(isOpera || isIE)) {
                this.trap.style.left = this.cursor.offsetLeft + "px";
            }
            this.focusTrap();
        }
    };

    Doc._p.scrollToCursor = function s2C(rect) {
        if (embed) return;

        var scrolls = this.getScrollOffsets().top;
        var winScroll = scrolls - this.viewport.scrollTop;
        var vpHeight = this.viewport.clientHeight;
        if (rect.top < scrolls + 40) {// +30 for the toolbar
            this.viewport.scrollTop = Math.max(rect.top - winScroll - 50, 0);
        } else if (rect.bottom > scrolls + vpHeight - 10) {
            this.viewport.scrollTop = rect.bottom - vpHeight - winScroll + 20;
        }
    };

    //  L I S T E N E R S
    Doc._p.updateParagraphHtml = function uPH(spec, val) {
        var doc = this;
        if (!doc.body) { return; }

        //if (val==oldval) { return; } // FIXME open pA

        var pid = spcf.get(spec, ';');
        var pbox = doc.findParagraphBox(pid);
        pbox && pbox.parentNode.removeChild(pbox);
        if (!val) { return; }

        var newp = doc.createParagraphNode(pid, true);
        var pp = doc.get(pid + '.pp');
        if (pp) {
            doc.body.insertBefore(newp, doc.findParagraphBox(pp).nextSibling);
        } else {
            doc.body.insertBefore(newp, doc.body.firstChild);
        }
        this.recoverCursor();
    };

    Doc._p.updateParagraphTextHtml = function uPH(spec, val) {
        var doc = this;
        if (!doc.body) { return; }

        //if (val==oldval) { return; } // FIXME open pA

        var pid = spcf.get(spec, ';');
        var p = doc.findParagraphNode(pid);
        var pc = p && p.parentNode;
        if (!val) {
            if (pc) {
                var pbox = pc.parentNode;
                pbox.parentNode.removeChild(pbox);
            }
            return;
        }

        if (pc) { // update just text-part of paragraph
            var el = doc.stageNode(doc.getTextBlockHtml(pid));
            pc.replaceChild(el, p);
        } else { // update all paragraph
            var newp = doc.createParagraphNode(pid, true);
            var prevp = doc.get(pid + '.pp');
            var beforeNode = prevp ?
                    doc.findParagraphBox(prevp).nextSibling :
                    doc.body.firstChild;
            doc.body.insertBefore(newp, beforeNode);
        }
    };

    Doc._p.recoverCursor = function rC() {
        if (!this.body) { return; }

        var sel = this.findVisiblePosition(this.get('.se'));
        var fixsel = sel;
        if (!sel) { return; }

        var pid = spcf.get(sel, ';');
        var pos = spcf.get(sel, ':');
        if (pos && pid) {
            var rect = this.getPositionBySpec(pid + pos);
            if (!rect) { rect = this.getPositionBySpec(fixsel = pid); }
            if (!rect) { rect = this.getPositionBySpec(fixsel = ';03+02'); }
            // TODO nicer recovery
            if (!rect) { return; }

            this.drawCursor(rect);
            if (sel != fixsel) { this.setCursor(fixsel); }
        }
    };

    function cursorToRecover() {
        var self = this;
        if (!self.curRecOn) {
            self.curRecOn = true;
            this.ntfOnClear.push(function () {
                self.recoverCursor();
                self.curRecOn = null;
            });
        }
    }

    //  S E L E C T I O N  C O N T R O L

    Doc._p.getRects = function gRs(elem) {
        if (!elem) { throw new Error('no elem - no rects'); }
        var rects = elem.getClientRects();
        var ret = [];
        var scrollOffset = this.getScrollOffsets();
        var st = scrollOffset.top;
        var sl = scrollOffset.left;
        var i;
        for (i = 0; i < rects.length; i++) {
            var r = rects[i];
            ret.push({
                top: r.top + st,
                bottom: r.bottom + st,
                left: r.left + sl,
                right: r.right + sl,
                height: r.bottom - r.top,
                width: r.right - r.left
            });
        }
        return ret;
    };

    Doc._p.getBookmarkRectAt = function gBRA(span, offset) {
        if (!span) { throw new Error("no span?"); }
        var text;
        for (text = span.firstChild;
                !!text && offset > 0 && offset >= text.nodeValue.length;
                text = text.nextSibling) {
            offset -= text.nodeValue.length; // may not be normalized
        }
        //if (text.nodeType!=3)
        //    throw "expected a text node";
        if (offset !== 0) {
            var right_half = text.splitText(offset);
            span.insertBefore(this.bkmark, right_half);
        } else {
            span.insertBefore(this.bkmark, text);
        }
        this.bkmark.style.display = 'inline';
        var ret = this.getRects(this.bkmark)[0];
        if (ret === undefined) { ret = null; } //ie
        if (ret !== null) { // not entirely drawn?
            ret.p = span.parentNode;
            ret.span = span;
            ret.right = ret.left;
            ret.width = 0;
            ret.offset = offset;
            if (isOpera) {
                var sprect = this.getRects(span);
                ret.height = sprect[0].height; // Opera collapses bmark to the top
                ret.bottom = ret.top + ret.height;
            }
        }
        this.bkmark.style.display = 'none';
        this.bkmark.parentNode.removeChild(this.bkmark);
        this.misc.appendChild(this.bkmark);
        span.normalize();
        return ret;
    };

    Doc._p.getOuterSpanBySpec = function gOSBS(spec) {
        spec = spec || this.get('.se');
        spec = this.findVisiblePosition(spec);
        var pid = spcf.get(spec, ';');
        var p = this.findParagraphNode(pid);
        if (!p) { return null; }

        var id = spcf.get(spec, ':');
        var span = null;
        if (!id || id == pid.replace(';', ':')) { return {'span': p.firstChild, 'offset': 0}; }

        var ids = this.get(pid + '.id');
        if (!ids) { return null; } //the whole paragraph is not visible

        var off = id4.offset(ids, id);
        var s;
        for (s = p.firstChild; s; s = s.nextSibling) {
            if (id4.offset(ids, s.id) <= off) { span = s; } else { break; }
        }
        if (!span) { return null; } // id is not visible or nonexistant
        var inner_off = off - id4.offset(ids, span.id) + 1;
        return {'span': span, 'offset': inner_off};
    };

    Doc._p.getPositionBySpec = function gPBS(spec) {
        var spanoff = this.getOuterSpanBySpec(spec);
        if (!spanoff) { return null; }

        return this.getBookmarkRectAt(spanoff.span, spanoff.offset); // may be null
    };

    Doc._p.setCursor = function sC(spec, isShiftOn) {
        var s = spcf.split(this.get('.se'));
        spec = spcf.split(spec);
        if (s.length !== 0) {
            var cursor = s[0] + s[1];
            var anchor = (s.length === 4) ? s[2] + s[3] : cursor;
            if (isShiftOn && anchor != spec) {
                spec = spec + anchor;
            }
        }
        this.blinkPhase = true;
        this.set('.se', spec);
    };


    function p2i_dist(from, till, point) {
        if (point < from) { return from - point; }
        if (point > till) { return point - till; }
        return 0;
    }

    function p2r_dist(rect, x, y) {
        var ydist = p2i_dist(rect.top, rect.bottom, y);
        var xdist = p2i_dist(rect.left, rect.right, x);
        return ydist + xdist;
    }

    function rectInRect(inr, outr) {
        return inr.left + MAX_LINE_OVERLAP >= outr.left && inr.right <= outr.right + MAX_LINE_OVERLAP &&
                inr.top + MAX_LINE_OVERLAP >= outr.top && inr.bottom <= outr.bottom + MAX_LINE_OVERLAP;
    }

    var MAX_LINE_OVERLAP = 4;

    Doc._p.getSpecByPosition = function gSbP(x, y, elem) {
        if (papyrus.DEBUG) { console.log('specby start', x, y, elem); }

        if (elem && elem.id && ~elem.id.indexOf('_cursor')) {
            var se = this.get('.se');
            return spcf.get(se, ';') + spcf.get(se, ':');
        }

        while (elem && elem.nodeType !== 1) { elem = elem.parentNode; }
        var p = null;
        var span = null;

        if (elem) {
            var name = elem.tagName.toUpperCase();
            if (name === 'SPAN') {
                span = elem;
                p = elem.parentNode;
            } else if (name === 'P') {
                p = elem;
            }
            if (p && p.id) { p = document.getElementById(p.id); } // dead node events
            if (span && span.id) { span = document.getElementById(span.id); }
        }

        var mind, rect, cpid;
        if (!p) {
            mind = 1 << 20;
            for (cpid = ';03+02'; cpid; cpid = this.get(cpid + '.pn')) {
                var pe = this.findParagraphNode(cpid);
                rect = this.getRects(pe)[0];
                if (!rect) { continue; }

                var dist = p2i_dist(rect.top, rect.bottom, y);
                if (dist < mind) {
                    p = pe;
                    if (dist === 0) {
                        break;
                    } else {
                        mind = dist;
                    }
                    if (papyrus.DEBUG) { console.log('specby rect', mind, rect); }
                }
            }
        }

        var pid = spcf.get(p.id, ';');
        var ids = this.get(pid + '.id'), id;
        if (!ids) { return pid + pid.replace(';', ':'); } // empty line

        mind = 1 << 20;
        var line = -1;
        this.walkClientRects(p, function (r, l, s) {
            var dist2d = p2r_dist(r, x, y);
            if (r.bottom < y || r.top > y) {
                dist2d += 1 << 12;
            }
            if (dist2d < mind) {
                mind = dist2d;
                line = l;
                rect = r;
                span = s;
                if (papyrus.DEBUG) { console.log('specby wcr', mind, r, s, l); }
            }
        });

        var offset = this.findMiddleByBookmarkBinSearch(span, function (br) {
            if (papyrus.DEBUG) { console.log('specby fmb', br); }
            if (Math.min(br.bottom, rect.bottom) > Math.max(br.top, rect.top) + MAX_LINE_OVERLAP) {
                return br.left < x ? 1 : -1;
            }
            return br.bottom < y ? 1 : -1;
        });
        if (offset > 0) { /// FIXME sin
            var fd = Math.abs(this.getBookmarkRectAt(span, offset).left - x);
            var td = Math.abs(this.getBookmarkRectAt(span, offset - 1).left - x);
            if (fd > td) { offset--; }
        }

        var span_off = id4.offset(ids, span.id);
        if (offset + span_off > 0) {
            id = id4.at(ids, span_off + offset - 1);
        } else {
            id = pid.replace(';', ':');
        }
        if (papyrus.DEBUG) { console.log('specby ret', span_off, offset, pid, id); }

        return pid + id;
    };

    Doc._p.walkClientRects = function wCR(p, fn) {
        var line = 0;
        var prev = null;
        var span, i;
        for (span = p.firstChild; span; span = span.nextSibling) {
            var rects = this.getRects(span);
            for (i = 0; i < rects.length; i++) {
                var rect = rects[i];
                if (!!prev && rect.left < prev.right - MAX_LINE_OVERLAP) {// well...
                    line++;
                }
                prev = rect;
                fn(rect, line, span, p);
            }
        }
    };

    Doc._p.findMiddleByBookmarkBinSearch = function fMBS(span, fn) {
        var span_len = isIE ? span.innerText.length : span.textContent.length;
        var from_off = 0, till_off = span_len;
        while (from_off + 1 < till_off) {
            var mid_off = (from_off + till_off) >> 1;
            var br = this.getBookmarkRectAt(span, mid_off), mem;
            if ((mem = fn(br)) > 0) {
                from_off = mid_off;
            } else {
                till_off = mid_off;
            }
            if (papyrus.DEBUG) { console.log('fmby', mem, from_off + '...' + till_off); }
        }
        return till_off;
    };

    Doc._p.getSpecByLineOffset = function gSLO(p, line, x) {
        var span = null, rect = null, mind = 1 << 10;
        if ('true' == p.getAttribute('old')) {
            return this.get('.se');
        }
        this.walkClientRects(p, function findSpan(r, ln, s) {
            if (ln !== line) { return; }

            var dist = p2i_dist(r.left, r.right, x);
            if (dist < mind) {
                span = s;
                rect = r;
                mind = dist;
            }
        });
        if (!span) { throw new Error('no span found'); }

        var pid = spcf.get(p.id, ';');
        if (!span.id) { return pid + pid.replace(';', ':'); }// empty line

        var ids = this.get(pid + '.id'), id;

        var offset = this.findMiddleByBookmarkBinSearch(span, function (br) {
            return ((br.top < rect.top - MAX_LINE_OVERLAP) ||
                    (br.top < rect.top + MAX_LINE_OVERLAP && br.left < x)) ? 1 : -1;
        });
        if (offset > 0) {
            var fd = Math.abs(this.getBookmarkRectAt(span, offset).left - x);
            var td = Math.abs(this.getBookmarkRectAt(span, offset - 1).left - x);
            if (fd > td) { offset--; }
        }

        var span_off = id4.offset(ids, span.id);
        if (span_off + offset > 0) {
            id = id4.at(ids, span_off + offset - 1);
        } else {
            id = pid.replace(';', ':');
        }
        return pid + id;
    };

    //  U S E R  A C T I O N S

    Doc._p.moveCursorUpDown = function mCUD(isUp, isShiftOn) {
        var selection = this.get('.se');
        if (!selection) { return; }

        var pos = this.getPositionBySpec(selection);
        if (!pos) { return; }

        var x = 0, line = -1, maxline = 0;
        if (selection != this.memSel) {
            x = pos.left;
        } else {
            x = this.memX;
        }
        this.walkClientRects(pos.p, function getLineNum(rect, ln) {
            if (rectInRect(pos, rect)) { line = ln; }
            maxline = ln;
        });
        if (line === -1) { throw new Error('cant determ line number'); }

        var pid = spcf.get(pos.p.id, ';');
        var spec;
        if (isUp && line === 0) {
            var prev_pid = this.get(pid + '.pp');
            if (!prev_pid) { return; }

            var ml = 0;
            var prev_p = this.findParagraphNode(prev_pid);
            if (!prev_p) { throw new Error('prev p is missing'); }

            this.walkClientRects(prev_p, function (r, l) { ml = l; });
            spec = this.getSpecByLineOffset(prev_p, ml, x);
        } else if (!isUp && line === maxline) {
            var next_pid = this.get(pid + '.pn');
            if (!next_pid) { return; }

            var next_p = this.findParagraphNode(next_pid);
            if (!next_p) { throw new Error('next p is missing'); }

            spec = this.getSpecByLineOffset(next_p, 0, x);
        } else {
            spec = this.getSpecByLineOffset(pos.p, line + (isUp ? -1 : 1), x);
        }
        this.memX = x;
        this.memSel = spec;
        this.setCursor(spec, isShiftOn);
    };

    Doc._p.moveCursorPageUpDown = function mCPUD(isUp, isShiftOn) {
        //this.moveCursorUpDown(isUp,isShiftOn,viewportHeight);
        var height = this.viewport.clientHeight;
        var pos = this.getPositionBySpec();
        var spec = this.getSpecByPosition(pos.left, pos.top + height * (isUp ? -1 : 1));
        this.setCursor(spec, isShiftOn);
    };

    Doc._p.moveCursorHomeEndOf = function mCHEo(pid, isHome, isShiftOn) {
        var id = pid.replace(';', ':');
        var idstr = this.get(pid + '.id');
        if (!isHome && idstr.length) {
            id = id4.at(idstr, (idstr.length >> 2) - 1);
        }
        this.setCursor(pid + id, isShiftOn);
    };

    Doc._p.moveCursorHomeEnd = function mCHE(isHome, isShiftOn) {
        var sel_sp = this.get('.se');
        if (!sel_sp) { return; }

        //var pid = spcf.get(sel_sp,';'), id;
        //this.moveCursorHomeEndOf(pid,isHome,isShiftOn);
        var pos = this.getPositionBySpec(sel_sp);
        var line = -1;
        this.walkClientRects(pos.p, function getLineNum(rect, ln) {
            if (rectInRect(pos, rect)) { line = ln; }
        });
        if (line === -1) { throw new Error('line num cant be detectd'); }

        var to = this.getSpecByLineOffset(pos.p, line, isHome ? 0 : this.getRects(pos.p)[0].right);
        this.setCursor(to, isShiftOn);
    };

    Doc._p.moveCursorTopBottom = function mCTB(isTop, isShiftOn) {
        var ps = this.body.getElementsByTagName('P');
        var target_p = isTop ? ps.item(0) : ps.item(ps.length - 1);
        var pid = spcf.get(target_p.id, ';');
        this.moveCursorHomeEndOf(pid, isTop, isShiftOn);
    };

    Doc._p.moveCursorRightLeft = function mCRL(isRight, byWord, isShiftOn) {
        var sel = this.get('.se');
        if (!sel) { return; }

        var pos;
        if (byWord) {
            pos = this.getNextWordPos(sel, !isRight);
        } else {
            pos = this.getNextPos(sel, !isRight);
        }
        if (pos) { this.setCursor(pos, isShiftOn); }
    };

    var memoxy = ''; // IE hack
    Doc._p.moveCursorXY = function mCXY(ev, isShiftOn) {
        var key = isShiftOn + ev.x + ':' + ev.y;
        if (key === memoxy) { return; }

        memoxy = key;
        var spec = this.getSpecByPosition(ev.x, ev.y, ev.target);
        if (papyrus.DEBUG) { console.log('xy ', ev.x, ' ', ev.y, ' ', spec); }
        this.setCursor(spec, isShiftOn);
    };

    Doc._p.selectWord = function sW(ev) {
        var spec = this.get('.se');
        var clickspec = this.getSpecByPosition(ev.x, ev.y, ev.target);
        if (spcf.get(spec, ';') !== spcf.get(clickspec, ';')) { return; }

        var fro = this.getNextWordPos(clickspec, false);
        var tll = this.getNextWordPos(clickspec, true);
        if (spcf.get(tll,';')!==spcf.get(fro,';'))
            fro = this.getNextPos(fro,true);
        this.setCursor(fro + tll);
    };

    Doc._p.selectParagraph = function sP(ev) {
        var doc = this;
        var pid = spcf.get(doc.get('.se'), ';');
        var clickspec = doc.getSpecByPosition(ev.x, ev.y, ev.target);
        if (pid !== spcf.get(clickspec, ';')) { return; }

        var nextpid = doc.get(pid + '.pn');
        doc.set('.se', pid + ':' + pid.substr(1) + nextpid + ':' + nextpid.substr(1));
    };

    papyrus.textAreaSelect = textAreaSelect;
    function textAreaSelect(field) {
        if (field.createTextRange) {
            var selRange = field.createTextRange();
            selRange.collapse(true);
            selRange.moveStart('character', 0);
            selRange.moveEnd('character', field.value.length);
            selRange.select();
        } else if (field.setSelectionRange) {
            field.setSelectionRange(0, field.value.length);
        } else if (field.anchor) {
            field.anchor = 0;
            field.selectionEnd = field.value.length;
        }
        field.focus();
    }

    Doc._p.copyRangeToClipboard = function cR2C(range) {
        var self = this;
        range = range || self.get('.se');
        if (!range) { return; }

        var txt = [];
        self.walkRange(range, function (pos, symb) {
            txt.push(symb);
        }, true);
        if (!txt.length) { return; }

        if (isIE) {// FIXME!!!! DOES THIS WORK? WHY this ????
            self.skipNextInput = true;
        }
        self.trap.value = txt.join('');
        papyrus.textAreaSelect(self.trap);
        setTimeout(function () { self.trap.value = ''; }, 100);
    };

    Doc._p.selectAll = function sA() {
        var last_pid, pid;
        for (pid = ';03+02'; pid; pid = this.get(pid + '.pn')) {
            last_pid = pid;
        }
        var ids = this.get(last_pid + '.id');
        var last_id = ids ? id4.at(ids, (ids.length >> 2) - 1) : last_pid.replace(';', ':');
        this.setCursor(last_pid + last_id + ';03+02:03+02');
    };

    //noinspection FunctionWithInconsistentReturnsJS
    Doc._p.moveCursor = function mC(ev) {
        //console.log('MOVE', ev);
        if (!document.activeElement || document.activeElement.getAttribute('id') != 'trap') {
            return;
        }
        var ctrlOn = isMac ? ev.metaKey : ev.ctrlKey;
        var shiftOn = ev.shiftKey;
        var altOn = ev.altKey;
        switch (ev.keyCode) {
        case KEYBOARD.PAGE_UP:
            this.moveCursorPageUpDown(true, shiftOn);
            break;
        case KEYBOARD.PAGE_DOWN:
            this.moveCursorPageUpDown(false, shiftOn);
            break;
        case KEYBOARD.HOME:
            if (ctrlOn) {
                this.moveCursorTopBottom(true, shiftOn);
            } else {
                this.moveCursorHomeEnd(true, shiftOn);
            }
            break;
        case KEYBOARD.END:
            if (ctrlOn) {
                this.moveCursorTopBottom(false, shiftOn);
            } else {
                this.moveCursorHomeEnd(false, shiftOn);
            }
            break;
        case KEYBOARD.LEFT:
            if ((isMac && altOn) || (!isMac && ctrlOn)) {
                this.moveCursorRightLeft(false, true, shiftOn);
            } else if (ctrlOn) {
                this.moveCursorHomeEnd(true, shiftOn);
            } else {
                this.moveCursorRightLeft(false, false, shiftOn);
            }
            break;
        case KEYBOARD.UP:
            if (isMac && (ctrlOn || ev.metaKey)) {
                this.moveCursorTopBottom(true, shiftOn);
            } else {
                this.moveCursorUpDown(true, shiftOn);
            }
            break;
        case KEYBOARD.RIGHT:
            if ((isMac && ev.altKey) || (!isMac && ctrlOn)) {
                this.moveCursorRightLeft(true, true, shiftOn);
            } else if (ctrlOn) {
                this.moveCursorHomeEnd(false, shiftOn);
            } else {
                this.moveCursorRightLeft(true, false, shiftOn);
            }
            break;
        case KEYBOARD.DOWN:
            if (isMac && (ctrlOn || ev.metaKey)) {
                this.moveCursorTopBottom(false, shiftOn);
            } else {
                this.moveCursorUpDown(false, shiftOn);
            }
            break;
        case KEYBOARD.C:
            if (ctrlOn) {
                this.copyRangeToClipboard();
            }
            return;//TODO maybe true?
        case KEYBOARD.A:
            if (ctrlOn) {
                this.selectAll();
            } else {
                return true;
            }
            break;
        /*case KEYBOARD.S:
            if (!ctrlOn)
                return true;
            if (!ev.altKey)
                this.setBaseVersionBySelection();
            else
                this.flipRedlining();
            break;*/
        case KEYBOARD.E:
            if ((ctrlOn && !isMac) || (ev.metaKey && isMac)) {
                this.setVersion();
            } else {
                return true;
            }
            break;
        default:
            return true;
        }
        //this.blinkCursor();

        ev.preventDefault();
    };

    Doc._p.navigate = function () {
        var self = this;
        if (self.navigate_to) {
            window.open(self.navigate_to, '_blank');
            delete self.navigate_to;
        }
    };

    Doc._p.prepare_navigation = function (ev) {
        var self = this, go='';
        if (ev.shiftKey || !ev.target) { return false; }

        if (ev.target.tagName==='SPAN') {
            var clss = ev.target.getAttribute('class');
            if (!clss || clss.indexOf('uri_on') == -1) { return false; }

            var gospan = ev.target;
            while (gospan && !self.has(gospan.id + '.go')) { gospan = gospan.previousSibling; }
            if (!gospan) { return false; }

            go = self.get(gospan.id + '.go');
        } else { // search for <a>
            for(var e=ev.target; e&&e!=self.body&&e.tagName!=='A'; e=e.parentNode);
            if (e.tagName==='A')
                go=e.getAttribute('href');
        }

        if (!go || go.substr(0, 4).toLowerCase() != 'http') { return false; }
        // TODO warnigns security etc
        self.mouseDown = false;
        self.navigate_to = go;
        return true;
    };

    function resetUserCSS() {
        var css_text = this.getHiliCSS();
        var hili = document.getElementById('_hili');
        if (!hili) { return; }

        if (!isIE) {  // :)
            hili.innerHTML = css_text;
        } else {
            var stysh = document.styleSheets;
            var s = 0;
            while (stysh[s].id != "_hili") { s++; }
            var style = stysh[s];
            style.cssText = css_text; // dear ie
        }
    }

    function showSelection(spec, val) {
        var doc = this;
        if (!doc.body) { return; }

        var s = spcf.split(val || '');
        if (s.length === 4) {
            var from_p = s[0], from = s[1];
            var till_p = s[2], till = s[3];
            doc.set('#se.at', from + till + ' ' + from_p + till_p + ' selected_on'); // TODO flip traps
        } else {
            if (doc.get('#se.at') != 'selected_on') {
                doc.set('#se.at', 'selected_on');
            }
        }
        if (s.length >= 2) {
            var rect = doc.getPositionBySpec(s[0] + s[1]);
            if (rect) {
                doc.drawCursor(rect);
                doc.scrollToCursor(rect);
            }
        }
    }

    var doc;
    function bindToDOM(docOpened) {
        doc = docOpened;
        if (papyrus.DEBUG) { console.info('binding doc to DOM'); }

        var body = document.getElementById("body");
        var misc = document.getElementById("misc");
        var uid = doc.get('!' + doc.ssn + '.sn');
        doc.uid = uid;
        doc.uidSafe = spcf.safe32(uid);
        doc.linkToDom(body, misc);

        doc.initEditor();
        papyrus.showDocument(doc);

        doc.set('.se', doc.state['.se'] || ';03+02:03+02');

        if (isIos) {
            doc.disableEditing();
        }

        setTimeout(function(){doc.slowRedraw();},10); // hili
    }

    function unbindFromDOM() {
        //papyrus.hideDocument();
        if (doc) {
            doc.disableEditing();
            doc.destroyEditor();
            doc.unlinkFromDom();
            doc = null;
        }
    }

    function showDocOnSuccessLogin(spec, ssnlist) {
        var doc = this;
        var docId = spcf.get(spec, '/');
        var uid = spcf.get(spec, '@');
        if (doc.spec !== docId || doc.uid !== uid || !ssnlist) { return; }

        papyrus.showDocument(doc);
    }

    papyrus.addFilter('.uj', resetUserCSS);
    papyrus.addFilter('.ok', resetUserCSS);
    papyrus.addFilter('.ph', cursorToRecover);
    papyrus.addFilter('.at', cursorToRecover);
    papyrus.addFilter('.mA', Doc._p.updateParagraphHtml);
    papyrus.addFilter('.mD', Doc._p.updateParagraphHtml);
    papyrus.addFilter('.bc', Doc._p.updateParagraphHtml);
    papyrus.addFilter('.pA', Doc._p.updateParagraphHtml);
    papyrus.addFilter('.ph', Doc._p.updateParagraphTextHtml);
    papyrus.addFilter('.se', showSelection);
    papyrus.addFilter(',li', showDocOnSuccessLogin);

    //for instant text changing
    papyrus.addFilter('.PP', Doc._p.renderPendingParagraphs);

    papyrus.on('docReady', bindToDOM);
    papyrus.on('docUnload', unbindFromDOM);

}(g['papyrus'] = g['papyrus'] || {}));
