//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    require('./doc');

    var spcf = papyrus.spcf;
    var Auth = papyrus.Auth;
    var Doc = papyrus.Doc;

    Doc._p.getUser = function (uid) {
        var doc = this;
        var li = doc.spec + uid + ',li';
        var status = doc.get(li) ? 'online' : 'offline';
        var overallContribution = parseInt(doc.get('.TC') || '1');
        var userContribution = parseInt(doc.get(uid + '.tc') || '0');
        var res = {
            uid: uid,
            displayName: doc.get(uid + '.ur') || doc.get(uid + '.ul'),
            auth: doc.get(uid + '.uc') || '_',
            avatarUrl: doc.get(uid + '.ua') || '/public/web/img/anonymous_user.jpg',
            login: doc.get(uid + '.ul'),
            contribution: Math.round(100 * userContribution / overallContribution),
            status: status,
            exit: 'true' === doc.get(uid + '.ue') ? 'exit' : ''
        };
        return res;
    };

    Doc._p.getUserAuth = function (uid) {
        return Auth.as(this.get(uid + '.uc'));
    };

    Doc._p.getAllUsers = function () {
        var doc = this;
        var users = spcf.split(doc.get('.UL') || '');
        var i, len;
        var items = [];
        var contributionSum = 0;
        for (i = 0, len = users.length; i < len; i++) {
            var user = doc.getUser(users[i]);
            items.push(user);
            contributionSum += user.contribution;
        }
        if (contributionSum && items.length) {
            var delta = 100 - contributionSum;
            items[0].contribution += delta;
        }
        return items;
    };

    Doc._p.isMeAdmin = function isMeAdmin() {
        return this.state[this.uid + '.uc'] === Auth.admin.code;
    };

    Doc._p.getUsersCount = function () {
        return spcf.split(this.get('.UL') || '').length;
    };

    function maintainUsersList(spec, val) {
        if (spcf.pattern(spec) !== '!@.') { return; } //skip spec with striped serial

        var uid = spcf.get(spec, '@');
        var userIds = this.get('.UL') || '';
        if (userIds.indexOf(uid) === -1) {
            userIds += uid;
            this.set('.UL', userIds);
            this.set(uid + '.uc', val);
        }
    }

    function userAttrChanged(spec) {
        if (spcf.pattern(spec) !== '@.') { return; } //skip spec with striped serial

        var doc = this;
        var uid = spcf.get(spec, '@');
        var user = doc.getUser(uid);
        papyrus.emit('userChanged', doc, user);

        if (spcf.type(spec) === '.uc') {
            papyrus.emit('userAuthChanged', doc, uid, user.auth);
        }
    }

    function refreshRoster() {
        var doc = this;
        papyrus.emit('rosterChanged', doc.getAllUsers());
    }

    function onUserStatusChange(spec, ssnlist) {
        var doc = this;
        var uid = spcf.get(spec, '@');
        doc.state[spec] = ssnlist;
        papyrus.emit('userOnline', uid, !!ssnlist);
    }

    function usersCountChanged(spec, usersList) {
        papyrus.emit('usersCountChanged', this, spcf.split(usersList || '').length);
    }

    var stripSeqMark = Doc._p.stripSeqMark;
    papyrus.addFilter(".dn", stripSeqMark);//disable notifications
    papyrus.addFilter(".uc", stripSeqMark);
    papyrus.addFilter(".un", stripSeqMark);
    papyrus.addFilter(".ua", stripSeqMark);
    papyrus.addFilter(".ul", stripSeqMark);
    papyrus.addFilter(".up", stripSeqMark);
    //user exit
    papyrus.addFilter('.ue', stripSeqMark);

    //user change
    papyrus.addFilter('.uj', maintainUsersList);

    papyrus.addFilter('.uc', userAttrChanged);
    papyrus.addFilter('.un', userAttrChanged);
    papyrus.addFilter('.ua', userAttrChanged);
    papyrus.addFilter('.ul', userAttrChanged);
    papyrus.addFilter('.ue', userAttrChanged);

    papyrus.addFilter('.ok', refreshRoster);
    papyrus.addFilter('.UL', usersCountChanged);

    papyrus.addFilter(',li', onUserStatusChange, 100000);

    papyrus.addFilter(',un', function fillUsername(spec, dn) {
        papyrus.emit('currentUser.dn', dn);
    });

    papyrus.addFilter(',ua', function setUserAvatar(spec, avatarUrl) {
        papyrus.emit('currentUser.avatarUrl', avatarUrl);
    });

    papyrus.on('offline', function clearUsersOnlineStatus(doc) {
        var uidList = spcf.split(doc.get('.UL'));
        var i, l;
        for (i = 0, l = uidList.length; i < l; i++) {
            var uid = uidList[i];
            doc.set(doc.spec + uid + ',li', '');
        }
    });

}(g['papyrus'] = g['papyrus'] || {}));
