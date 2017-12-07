//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint,ThisExpressionReferencesGlobalObjectJS
(function (papyrus) {
    require('./doc-text');

    var spcf = papyrus.spcf;

    var docList = {};

    function getDocInfo(docId, currentDoc) {
        var docInfo = docList[docId];
        if (!docInfo) {
            docInfo = docList[docId] = {
                id: docId,
                title: 'Живое письмо',
                lastUpdated: null,
                url: papyrus.getUriBySpec(docId),
                selected: currentDoc && currentDoc.spec === docId
            };
        }
        return docInfo;
    }

    papyrus.addFilter(',dt', function (spec, newTitle) {
        var docId = spcf.get(spec, '/');
        var docInfo = docList[docId];
        if (!docInfo) {
            docInfo = docList[docId] = {
                id: docId,
                title: newTitle,
                lastUpdated: null,
                url: papyrus.getUriBySpec(docId),
                selected: false
            };
        } else {
            docInfo.title = newTitle;
        }
        docInfo.selected = (this.spec === docId);
        papyrus.emit('docChanged', docInfo);
    });

    papyrus.addFilter(',du', function (spec, newLastUpdated) {
        var docId = spcf.get(spec, '/');
        var docInfo = getDocInfo(docId, this);
        docInfo.lastUpdated = newLastUpdated;
        papyrus.emit('docChanged', docInfo);
    });

    papyrus.addFilter(',DL', function (spec, docIds) {
        var doc = this;
        var docListNew = {};
        var asArray = [];
        docIds = spcf.split(docIds);
        docIds.forEach(function (docId) {
            docListNew[docId] = docList[docId] || {
                id: docId,
                title: 'Живое письмо',
                lastUpdated: null,
                url: papyrus.getUriBySpec(docId),
                selected: (doc.spec === docId)
            };
            asArray.push(docListNew[docId]);
        });
        docList = docListNew;
        papyrus.emit('docListChanged', asArray);
    });

    papyrus.on('docReady', function (doc) {
        var docInfo = getDocInfo(doc.spec, doc);
        docInfo.title = doc.getTitle();
        docInfo.selected = true;
        papyrus.emit('docChanged', docInfo);
    });

    papyrus.on('docUnload', function (doc) {
        if (!doc) { return; }

        var docInfo = docList[doc.spec];
        if (docInfo) {
            docInfo.selected = false;
            papyrus.emit('docChanged', docInfo);
        }
    });

    papyrus.on('titleChanged', function (doc, title) {
        var docInfo = getDocInfo(doc.spec, doc);
        docInfo.title = title;
        papyrus.emit('docChanged', docInfo);
    });

}(g['papyrus'] = g['papyrus'] || {}));
