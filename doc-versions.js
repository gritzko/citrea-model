//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint,ThisExpressionReferencesGlobalObjectJS
(function (papyrus) {
    require('./doc');

    var spcf = papyrus.spcf;
    var Doc = papyrus.Doc;

    Doc._p.getVersion = function (ver_id) {
        var doc = this;
        var inv = doc.get('.ui') || '';
        var res = {
            versionId: ver_id,
            since: spcf.tok2long(doc.get(ver_id + '.ts')),
            till: null,
            href: papyrus.getUriBySpec(doc.spec + inv + '*' + ver_id.substr(1))
        };

        var tillAsTok = doc.get(ver_id + '.tt');
        if (tillAsTok) {
            res.till = spcf.tok2long(tillAsTok);
        }
        return res;
    };

    Doc._p.getAllVersions = function (versionIds) {
        var doc = this;
        if (!versionIds) { versionIds = doc.get('.VL'); }
        if (!versionIds) { return []; }

        var res = [];
        versionIds = spcf.split(versionIds);
        var i, len;
        for (i = 0, len = versionIds.length; i < len; i++) {
            var verId = versionIds[i];
            var version = doc.getVersion(verId);
            if (!version.till) { continue; }

            res.push(version);
        }
        res.sort(function byTillDesc(a, b) { return b.till - a.till; });
        var inv = doc.get('.ui') || '';
        res.forEach(function(version, idx) {
            if (idx === res.length - 1) return;

            version.href = papyrus.getUriBySpec(doc.spec +
                    inv +
                    '*' + version.versionId.substr(1) +
                    '!' + res[idx + 1].versionId.substr(1));
        });
        return res;
    };

    Doc._p.findClosestVersion = function (versionId) {
        versionId = '$' + versionId.substr(1);
        var versions = this.getAllVersions();
        for (var i = versions.length - 1; i >= 0; i--) {
            if (versions[i].versionId >= versionId) {
                return versions[i];
            }
        }
        if (versions.length) {
            return versions[0];
        } else {
            return null;
        }
    };

    papyrus.addFilter('.VL', function versionListChanged(spec, versionIds) {
        papyrus.emit('versionListChanged', this.getAllVersions(versionIds));
    });

    papyrus.addFilter('.ok', function refreshVersionsOnOk() {
        papyrus.emit('versionListChanged', this.getAllVersions());
    });
}(g['papyrus'] = g['papyrus'] || {}));