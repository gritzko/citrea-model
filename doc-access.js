//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./doc');

    var spcf = papyrus.spcf;
    var Doc = papyrus.Doc;
    var stripSeqMark = Doc._p.stripSeqMark;

    Doc._p.getPrivacyMode = function () {
        return this.get('.am') || 'public';
    };

    Doc._p.isPublic = function () {
        return this.getPrivacyMode() === 'public';
    };

    Doc._p.isReadonly = function () {
        return 'true' === this.get('.ar');
    };

    Doc._p.isPasswordProtected = function () {
        return 'true' === this.get('.ap');
    };

    function onPrivatePublic(spec, mode) {
        if (spcf.pattern(spec) !== '!.') { return; }
        papyrus.emit('privacyModeChanged', this, mode || 'public');
    }

    function onReadOnly(spec, ro) {
        if (spcf.pattern(spec) !== '!.') { return; }
        papyrus.emit('readOnlyChanged', this, 'true' === ro);
    }

    function onPassword(spec, withPwd) {
        if (spcf.pattern(spec) !== '!.') { return; }
        papyrus.emit('passwordChanged', this, 'true' === withPwd);
    }

    //access-controls
    papyrus.addFilter('.am', stripSeqMark);
    papyrus.addFilter('.ar', stripSeqMark);
    papyrus.addFilter('.ap', stripSeqMark);
    papyrus.addFilter('.aP', stripSeqMark);

    papyrus.addFilter('.am', onPrivatePublic);
    papyrus.addFilter('.ar', onReadOnly);
    papyrus.addFilter('.ap', onPassword);


}(g['papyrus'] = g['papyrus'] || {}));
