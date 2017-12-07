//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    require('./spcf.js');

    function tightJoin() {
        return this.length === 1 ? this[0] : this.join('');
    }

    var escs = {
        '\n': '\\n',
        '\t': '\\t',
        ' ': '\\s',
        '\u0008': '\\b',
        '\u0018': '\\B',
        '\r': '\\r',
        '\\': '\\\\'
    };
    var cses = (function initUnEsc() {
        var res = {};
        var s;
        for (s in escs) {
            res[escs[s]] = s;
        }
        return res;
    }());
    var esctypes = {
        '.pw': 1,
        '.pt': 1,
        '.in': 1,
        '?ia': 1,
        ',er': 1
    };
    var re_meta = /([\\\.\^\$\*\+\?\(\)\[\]\{\}:=!\|,\-])/g;

    var esc = {};

    esc.esc = function (str) {
        return (str || '').replace(/[\r\n\t \u0008\u0018\\]/g, function (a) { return escs[a]; });
    };
    esc.unesc = function (esc) {
        //noinspection JSLint
        return esc.replace(/\\./g, function (e) { return cses[e]; });
    };
    esc.svbuf = function (spec, val) {
        var ret = [];
        ret.svpush = esc.bufPush;
        ret.toString = tightJoin;
        if (spec) {
            ret.svpush(spec, val);
        }
        return ret;
    };
    esc.bufPush = function (spec, val) {
        if (esctypes[papyrus.spcf.type(spec)]) {
            val = esc.esc(val);
        }
        this.push(spec + '\t' + val + '\n');
    };
    esc.svbufParse = function (msg) {
        var ret = msg.split(/[\n\r]+/) || []; //msg.match(spcf.re_specval_mg) || [];
        ret.reverse();
        ret.svpop = esc.bufPop;
        ret.toString = tightJoin;
        return ret;
    };
    esc.bufPop = function () {
        var line = this.pop();
        if (!line) {
            return null;
        }
        var spcf = papyrus.spcf;
        var m = spcf.re_specval.exec(line);
        if (!m) {
            throw new Error('can\'t parse operation: "' + line + '"');
        }
        var ret = { spec: spcf.split(m[1]), val: m[5], specStr: m[1] };
        if (esctypes[spcf.type(ret.spec)]) {
            ret.val = esc.unesc(ret.val);
        }
        return ret;
    };
    esc.svbufParse_bySplit = function (msg) {
        var ret;
        if (!msg) {
            ret = [];
        } else {
            ret = msg.split('\n');
        }
        ret.reverse();
        ret.svpop = esc.bufPop;
        ret.toString = tightJoin;
        return ret;
    };
    esc.bufPop_bySubstr = function () {
        var line = this.pop();
        if (!line) { return null; }

        var pos = line.indexOf('\t');
        //noinspection JSLint
        if (!~pos) { throw new TypeError('malformed specval'); }

        var spcf = papyrus.spcf;
        var specStr = line.substr(0, pos);
        var val = line.substr(pos + 1);
        var ret = {spec: spcf.split(specStr), val: val, specStr: specStr};
        if (esctypes[spcf.type(ret.spec)]) {
            ret.val = esc.unesc(ret.val);
        }
        return ret;
    };
    esc.htmlesc = function (text) {
        return text.replace(/[&<>"'`]/g, function (chr) {
            return '&#' + chr.charCodeAt(0) + ';';
        });
    };
    esc.regesc = function (str) {
        return str.replace(re_meta, '\\$1');
    };

    papyrus.esc = esc;

}(g['papyrus'] = g['papyrus'] || {}));
