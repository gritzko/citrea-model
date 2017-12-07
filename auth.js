//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,ThisExpressionReferencesGlobalObjectJS,JSLint
(function (papyrus) {

    function Auth(code, sub) {
        this.code = code;
        this.sub = sub;
    }

    Auth.admin = new Auth('a', 'awcr_');
    Auth.write = new Auth('w', 'wcr_');
    Auth.comment = new Auth('c', 'cr_');
    Auth.read = new Auth('r', 'r_');
    Auth.nobody = new Auth('_', '_');

    var code2auth = {
        'a': Auth.admin,
        'w': Auth.write,
        'c': Auth.comment,
        'r': Auth.read,
        '_': Auth.nobody
    };

    Auth.as = function (value) {
        var res;
        if (value) {
            if (value.constructor == Auth) {
                res = value;
            } else {
                res = code2auth[value];
                if (!res) { res = Auth.nobody; }
            }
        } else {
            res = Auth.nobody;
        }
        return res;
    };

    Auth.prototype.has = function (auth) {
        return (this.sub.indexOf(Auth.as(auth).code) > -1);
    };

    Auth.prototype.compareTo = function (auth) {
        var other = Auth.as(auth);
        var t2o = (this.sub.indexOf(other.code) > -1 ? 1 : 0);
        var o2t = (other.sub.indexOf(this.code) > -1 ? 1 : 0);
        return o2t - t2o;
    };

    Auth.prototype.toString = function () {
        return this.code;
    };

    papyrus.Auth = Auth;

}(g['papyrus'] = g['papyrus'] || {}));