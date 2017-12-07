//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {

    function tightJoin() {
        return this.length === 1 ? this[0] : this.join('');
    }

    function tokString() {
        return this.quant + this.seq + (this.ssn !== '00' ? '+' + this.ssn : '');
    }

    var spcf = {};

    spcf.inf_seq = "\u802f\u802f";
    spcf.rs_seq = '[0-\u802f]{2}';
    spcf.rs_id4 = '(' + spcf.rs_seq + ")(" + spcf.rs_seq + ')';
    spcf.re_seq_g = new RegExp(spcf.rs_seq, "g");
    spcf.re_id4_g = new RegExp(spcf.rs_id4, "g");
    spcf.base32 = '234567abcdefghijklmnopqrstuvwxyz';
    spcf.rs_32 = '[a-zA-Z2-7]{3,6}';
    spcf.re_uritok = new RegExp('(' + spcf.rs_32 + ')(\\+' + spcf.rs_32 + ')?', "g");
    spcf.codes = "/!#@$=;:*,.?";
    //noinspection JSLint
    spcf.rs_codes = "[\\" + spcf.codes.match(/./g).join("\\") + "]";
    //noinspection JSLint
    spcf.rs_codes_plus = "[\\" + spcf.codes.match(/./g).join("\\") + "\\+]";
    //noinspection JSLint
    spcf.quants = spcf.codes.match(/./g);
    spcf.rs_uni = "(?:" + spcf.rs_seq + ")";
    spcf.rs_token = "(" + spcf.rs_codes + ")(" + spcf.rs_uni + ")(?:\\+(" + spcf.rs_uni + "))?";
    spcf.rs_token32 = "(" + spcf.rs_codes + ")(" + spcf.rs_32 + ")(?:\\+(" + spcf.rs_32 + "))?";
    spcf.rs_halftok = "(" + spcf.rs_codes_plus + ")(" + spcf.rs_uni + ")";
    spcf.rs_halftok32 = "(" + spcf.rs_codes_plus + ")(" + spcf.rs_32 + ")";
    spcf.rs_tokenhex = "(" + spcf.rs_codes + ")(" + spcf.rs_hex + ")-(" + spcf.rs_hex + ")";
    spcf.re_spec = new RegExp('(' + spcf.rs_token + ')*');
    spcf.rs_specval = '^((?:' + spcf.rs_token + ')+)\\t([\\u0020-\\uffff\\t]*)$';
    spcf.re_specval = new RegExp(spcf.rs_specval);
    spcf.re_specval_mg = new RegExp(spcf.rs_specval, 'mg');
    spcf.re_token_g = new RegExp(spcf.rs_token, "g");
    spcf.re_token32_g = new RegExp(spcf.rs_token32, 'g');
    spcf.re_halftok_g = new RegExp(spcf.rs_halftok, 'g');
    spcf.re_halftok32_g = new RegExp(spcf.rs_halftok32, 'g');
    spcf.rs_atom5 = "([\n\u0020-\ud7ff])$4(([\u0008\u0018])$4([\u0008\u0018]$4)*)?".replace(/\$4/g, spcf.rs_id4);
    spcf.re_atom5_g = new RegExp(spcf.rs_atom5, 'mg');
    spcf.re_weavelet_g = new RegExp('\\n$4([\u0020-\ud7ff]$4|\\n$4\u0008$4)*'.replace(/\$4/g, spcf.rs_id4), "mg");
    spcf.typeCodes = ",.?";
    //noinspection JSLint
    spcf.rs_typeCodes = "[\\" + spcf.typeCodes.match(/./g).join("\\") + "]";
    spcf.rs_typeToken = "(" + spcf.rs_typeCodes + ")(" + spcf.rs_uni + ")(?:\\+(" + spcf.rs_uni + "))?$";
    spcf.re_typeToken_g = new RegExp(spcf.rs_typeToken, 'g');

    spcf.add = function (spec, tok) {
        return spec + tok;
    };
    spcf.as = function (spec) {
        return (spec.constructor !== Array) ? spcf.split(spec) : spec;
    };
    spcf.is = function (spec) {
        return spcf.as(spec).toString() === spec.toString();
    };
    spcf.get = function (spec, quant, after) {
        spec = spcf.as(spec);
        var i = after !== undefined ? spec.indexOf(after) + 1 : 0;
        //noinspection JSLint
        if (i === -1) {
            throw new TypeError("not found: " + after);
        }
        while (i < spec.length) {
            if (spec[i].charAt(0) === quant) {
                return spec[i]; // FIXME ugly
            }
            i++;
        }
        return '';
    };
    spcf.getBySsn = function (spec, ssn) {
        ssn = ssn || '00';
        spcf.re_token_g.lastIndex = 0;
        var m;
        //noinspection JSLint
        while (m = spcf.re_token_g.exec(spec)) {
            var issn = m[3] || '00';
            if (ssn === issn) {
                return m[0];
            }
        }
        return '';
    };
    spcf.getParsed = function (spec, quant, after) {
        var tok = spcf.get(spec, quant, after);
        return !tok ? null : spcf.parse(tok);
    };
    spcf.rm = function (spec, tok) {
        spec = spcf.split(spec);
        var i = spec.indexOf(tok);
        //noinspection JSLint
        if (i > -1) {
            spec.splice(i, 1);
        }
        return spec;
    };
    spcf.replace = function (spec, tok, new_val) {
        spec = spcf.as(spec);
        var i = spec.indexOf(tok);
        if (i > -1) {
            spec.splice(i, 1, new_val.toString());
        }
        return spec;
    };
    spcf.flip = function (spec, tok) {
        spec = spcf.as(spec);
        var i = spec.indexOf(tok.toString());
        if (i > -1) {
            spec.splice(i, 1);
        } else {
            spec.push(tok);
        }
        return spec;
    };
    spcf.split = function (spec) {
        var ret;
        if (!spec || spec === 'null' || spec === 'undefined') {
            ret = [];
        } else {
            ret = spec.toString().match(spcf.re_token_g);
            if (!ret) {
                throw new Error("malformed specifier: " + spec);
            }
        }
        ret.toString = tightJoin;
        return ret;
    };
    spcf.split32 = function (spec32) {
        var ret;
        if (!spec32) {
            ret = [];
        } else {
            ret = spec32.toString().match(spcf.re_token32_g);
            if (!ret) {
                throw new Error("malformed specifier: " + spec32);
            }
        }
        ret.toString = tightJoin;
        return ret;
    };
    spcf.pattern = function (spec) {
        return spec.toString().replace(spcf.re_token_g, '$1');
    };
    spcf.sort = function (spec) {
        spec = spcf.as(spec);
        var codes = spcf.codes;
        spec.sort(function (a, b) {
            return codes.indexOf(a.charAt(0)) - codes.indexOf(b.charAt(0));
        });
        return spec;
    };
    spcf.has = function (spec, quant) {
        spec = spcf.as(spec);
        var i;
        for (i = 0; i < spec.length; i++) {
            if (spec[i].charAt(0) === quant) {
                return true;
            }
        }
        return false;
    };
    spcf.parse = function (spec) {
        spcf.re_token_g.lastIndex = 0;
        var m = spcf.re_token_g.exec(spec);
        if (!m) {
            throw new Error("malformed spec token " + spec);
        }
        return {
            quant: m[1],
            seq: m[2],
            ssn: m[3] || '00',
            token: m[0],
            id4: m[2] + (m[3] || '00'),
            toString: tokString
        };
    };
    spcf.safe32 = function (spec) {
        spcf.re_halftok_g.lastIndex = 0;
        var ret = [];
        var m;
        //noinspection JSLint
        while (m = spcf.re_halftok_g.exec(spec)) {
            ret.push(m[1], spcf.seq2base(m[2]));
        }
        return ret.join('');
    };
    spcf.unsafe32 = function (spec) {
        spcf.re_halftok32_g.lastIndex = 0;
        spec = spec.toString().toLowerCase().replace(/-/g, '+');
        var ret = [], m;
        //noinspection JSLint
        while (m = spcf.re_halftok32_g.exec(spec)) {
            ret.push(m[1], spcf.base2seq(m[2]));
        }
        return ret.join('').replace('+00', '');
    };
    spcf.type = function (spec) {
        var m = spec.toString().match(spcf.re_typeToken_g) || [];
        return (m && m.length) ? m[0] : null;
        /*
         spec = spcf.as(spec);
         for(var i=spec.length-1; i>=0; i--)
         if (',.?'.indexOf(spec[i].charAt(0))!==-1)
         return spec[i];
         */
    };
    spcf.filter = function (spec, qs) {
        var a = spcf.as(spec);
        var ret = spcf.split('');
        var i;
        for (i = 0; i < a.length; i++) {
            if (qs.indexOf(a[i].charAt(0)) > -1) {
                ret.push(a[i]);
            }
        }
        return ret;
    };
    spcf.id2spec = function (quant, id4) {
        console.warn('dont use id2spec!');
        if (!quant || spcf.quants.indexOf(quant) === -1) {
            throw new TypeError('wrong quant or no quant specified');
        }
        if (!id4) {
            return '';
        }
        var idsPart = id4.match(spcf.re_seq_g) || [];
        var res = [];
        var i, len;
        for (i = 0, len = idsPart.length; i < len; i += 2) {
            res.push(quant, idsPart[i]);
            if (idsPart[i + 1] !== '00') {
                res.push('+', idsPart[i + 1]);
            }
        }
        return res.join('');
    };
    spcf.seqinc = function (seq) {
        return spcf.int2seq(spcf.seq2int(seq) + 1);
    };
    spcf.tokinc = function (tok) {
        if (!tok.seq) {
            tok = spcf.parse(tok);
        }
        tok.seq = spcf.seqinc(tok.seq);
        return tok.toString();
    };
    spcf.seq2int = function (seq) {
        return ((seq.charCodeAt(0) - 0x30) << 15) + (seq.charCodeAt(1) - 0x30);
    };
    spcf.int2seq = function (i) {
        return String.fromCharCode((i >> 15) + 0x30, (i & 0x7fff) + 0x30);
    };
    spcf.seq2base = function (seq) {
        return spcf.int2base(spcf.seq2int(seq));
    };
    spcf.base2seq = function (b32) {
        return spcf.int2seq(spcf.base2int(b32));
    };
    spcf.int2base = function (i) {
        var ret = [];
        while (i) {
            ret.push(spcf.base32.charAt(i & 31));
            i >>= 5;
        }
        while (ret.length < 3) {
            ret.push('2');
        }
        return ret.reverse().join('');
    };
    spcf.base2int = function (b32) {
        var val = 0;
        var p;
        for (p = 0; p < b32.length; p++) {
            val <<= 5;
            val |= spcf.base32.indexOf(b32.charAt(p));
        }
        return val;
    };
    spcf.ssnMap = function (spec) {
        spec = spec.toString();
        spcf.re_token_g.lastIndex = 0;
        var ret = {};
        var m;
        //noinspection JSLint
        while (m = spcf.re_token_g.exec(spec)) {
            ret[m[3] || '00'] = m[2];
        }
        return ret;
    };
    spcf.maxVersionVector = function (version1, version2) {
        version1 = spcf.ssnMap(version1 || '');
        version2 = spcf.ssnMap(version2 || '');
        var ssn;
        for (ssn in version2) {
            var maxId = version2[ssn];
            var oldMaxId = version1[ssn];
            if (!oldMaxId || oldMaxId < maxId) {
                version1[ssn] = maxId;
            }
        }
        var res = [];
        for (ssn in version1) {
            res.push('$' + version1[ssn] + (ssn === '00' ? '' : '+' + ssn));
        }
        return res.join('');
    };
    spcf.random = function (quant, size) {
        size = size || 0;
        var intSeq;
        var intSsn = 0;
        var max30 = (1 << 30) - 1;
        var max15 = (1 << 15) - 1;
        var max = size > 0 ? max30 : max15;
        intSeq = (Math.random() * max) & max;
        if (size > 1) {
            max = size > 2 ? max30 : max15;
            intSsn = (Math.random() * max) & max;
        }
        return quant + spcf.int2seq(intSeq) +
                (intSsn ? '+' + spcf.int2seq(intSsn) : '');
    };
    spcf.tok2uri = function (tok) {
        var p = spcf.parse(tok);
        return spcf.seq2base(p.seq) +
                (p.ssn ? '-' + spcf.seq2base(p.ssn) : '');
    };
    spcf.uri2tok = function (uri, quant) {
        var m = spcf.re_uritok.exec(uri);
        return quant + spcf.base2seq(m[1]) +
                (m[2] ? '+' + spcf.base2seq(m[2]) : '');
    };
    spcf.tok2long = function (tok) {
        var p = spcf.parse(tok);
        return spcf.seq2int(p.seq) * 0x10000000 + spcf.seq2int(p.ssn);
    };
    spcf.long2tok = function (val, quant) {
        //TODO FIXME low is 28bit (7x4), but it should be 30bit !!!
        var high, low;
        if (val >= 0x10000000) {
            var valAsHex = val.toString(16);
            var splitPos = valAsHex.length - 7;
            low = parseInt(valAsHex.substr(splitPos), 16);
            high = parseInt(valAsHex.substr(0, splitPos), 16);
        } else {
            low = val;
            high = 0;
        }
        return quant + spcf.int2seq(high) + (low !== 0 ? '+' + spcf.int2seq(low) : '');
    };

    papyrus.spcf = spcf;

}(g['papyrus'] = g['papyrus'] || {}));
