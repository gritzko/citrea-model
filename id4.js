//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    require('./spcf.js');

    var id4 = {};

    id4.offset = function (ids, id) {
        var spcf = papyrus.spcf;
        var arr = ids.match(spcf.re_id4_g) || [];
        return arr.indexOf(spcf.parse(id).id4);
    };

    id4.at = function (ids, off) {
        var seq = ids.substr(off << 2, 2);
        var ssn = ids.substr(2 + (off << 2), 2);
        return ':' + seq + (ssn === '00' ? '' : '+' + ssn);
    };

    papyrus.id4 = id4;

}(g['papyrus'] = g['papyrus'] || {}));