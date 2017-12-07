//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./doc');

    var Doc = papyrus.Doc;
    var Auth = papyrus.Auth;
    var spcf = papyrus.spcf;

    papyrus.user2contact = function (user) {
        return {
            uid: user.uid,
            provider: '',
            kind: 'user',
            contactId: user.login || '',
            inviteId: '',
            auth: user.auth,
            dn: user.displayName,
            avatarUrl: user.avatarUrl,
            exit: user.exit,
            contribution: user.contribution
        };
    };

    Doc._p.getInviteLink = function () {
        var doc = this;
        var inv = doc.get('.ui') || '';
        return inv ? papyrus.getInviteLinkBySpec(doc.spec + inv) : null;
    };

    Doc._p.getInvite = function (invId) {
        var doc = this;
        var contactJSON = doc.get(invId + '.ii');
        if (!contactJSON) { return null; }

        var contact = JSON.parse(contactJSON);
        contact.inviteId = invId;
        contact.kind = 'invite';
        contact.auth = doc.get(invId + '.ic') || contact.auth;
        return contact;
    };

    Doc._p.getAllInvites = function () {
        var doc = this;
        var invIdList = spcf.split(doc.get('.IL') || '');
        var res = [];
        var i, len;
        for (i = 0, len = invIdList.length; i < len; i++) {
            var invId = invIdList[i];
            var invite = doc.getInvite(invId);
            if (!invite || Auth.nobody.has(invite.auth)) { continue; }
            res.push(invite);
        }
        return res;
    };

    Doc._p.getInviteCount = function () {
        var doc = this;
        var invIdList = spcf.split(doc.get('.IL') || '');
        var count = 0;
        var i, len;
        for (i = 0, len = invIdList.length; i < len; i++) {
            var inviteId = invIdList[i];
            var lastNotified = doc.get(inviteId + '.it');
            if (lastNotified) {
                lastNotified = new Date(lastNotified);
            }
            var now = new Date();
            var oneDay = 24 * 60 * 60 * 1000; // 1day
            if (lastNotified &&
                    (now.getTime() - lastNotified.getTime()) < oneDay) {
                count++;
            }
        }
        return count;
    };

    function onAddressBook(spec, abook) {
        try {
            abook = JSON.parse(abook);
        } catch (err) {
            console.warn('address book contacts not parsed');
        }
        var contacts = abook.data || [];
        papyrus.emit('contacts', contacts, abook.page >= abook.pagesCount);
    }

    function onInvitesListChange(spec, invitesList) {
        var doc = this;
        var invitesList = doc.getAllInvites();
        papyrus.emit('invitesCount', invitesList.length);
    }

    function onInviteAuthChange(spec, auth) {
        if (spcf.pattern(spec) !== '$.') { return; }
        var doc = this;
        var invId = spcf.get(spec, '$');
        var err;
        auth = Auth.as(auth);

        //change invite authority
        var contactJSON = doc.get(invId + '.ii');
        if (!contactJSON) {
            err = new Error(invId);
            err.code = 'invite_not_found';
            throw err;
        }
        var contact;
        try {
            contact = JSON.parse(contactJSON);
        } catch (ex) {
            var error = new Error(invId);
            error.code = 'error_parsing_invite';
            throw error;
        }
        contact.auth = auth.code;
        doc.set(invId + '.ii', JSON.stringify(contact));

        papyrus.emit('inviteChanged', doc.getInvite(invId));
    }

    function onInviteChange(spec) {
        //skip spec with striped id
        if (spcf.pattern(spec) !== '$.') { return; }

        var doc = this;
        var invId = spcf.get(spec, '$');
        var contact = doc.getInvite(invId);
        var invIdList = doc.get('.IL') || '';
        if (Auth.nobody.has(contact.auth)) {
            if (invIdList.indexOf(invId) > -1) {
                doc.set('.IL', spcf.replace(invIdList, invId, ''));
            }
        } else if (invIdList.indexOf(invId) === -1) {
            doc.set('.IL', spcf.add(invIdList, invId));
        }
        papyrus.emit('inviteChanged', contact);
    }

    function onShortInviteUrl(spec, shortInviteUrl) {
        this.shortInviteUrl = shortInviteUrl;
        papyrus.emit('shortInviteUrlChanged', this, shortInviteUrl);
    }

    var stripSeqMark = Doc._p.stripSeqMark;
    papyrus.addFilter(".ui", stripSeqMark);
    papyrus.addFilter('.ic', stripSeqMark);
    papyrus.addFilter('.ii', stripSeqMark);

    papyrus.addFilter(',ab', onAddressBook);

    papyrus.addFilter('.IL', onInvitesListChange);
    papyrus.addFilter('.ic', onInviteAuthChange);
    papyrus.addFilter('.ii', onInviteChange);

    papyrus.addFilter(',si', onShortInviteUrl);

}(g['papyrus'] = g['papyrus'] || {}));
