//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

if (!g.JST) {
    g._ = require('underscore');
    g.JST = require('../min/nanoislands.jst.js').JST;
    var jst_citrea = require('../min/citrea.jst.js').JST;
    var tmpl_name;
    for (tmpl_name in jst_citrea) {
        if (!jst_citrea.hasOwnProperty(tmpl_name)) { continue; }
        g.JST[tmpl_name] = jst_citrea[tmpl_name];
    }
}

//noinspection JSLint,JSHint
(function (papyrus, JST) {
    require('./doc-text.js');
    require('./file-icons.js');

    var spcf = papyrus.spcf;
    var Doc = papyrus.Doc;

    Doc._p.insertMediaContent = function (pid, mediaInfo) {
        var doc = this;
        if (!pid) { pid = ';03+02'; }
        pid = spcf.get(pid, ';');
        if (!doc.has(pid + '.pw')) { throw new Error('no paragraph found "' + pid + '"'); }

        if (mediaInfo.mediatype !== 'embed-video') {
            mediaInfo.url = '/yadisk/download?private_hash=' + encodeURIComponent(mediaInfo.hash);
            mediaInfo.previewUrl = '/yadisk/preview?private_hash=' + encodeURIComponent(mediaInfo.hash) + '&size=M';
            mediaInfo.fullsizeUrl = '/yadisk/preview?private_hash=' + encodeURIComponent(mediaInfo.hash) + '&size=ORIGINAL';
        }

        var val = {
            pid: pid,
            filename: mediaInfo.filename,
            mediatype: mediaInfo.mediatype,
            mimetype: mediaInfo.mimetype,
            hash: mediaInfo.hash,
            url: mediaInfo.url,
            previewUrl: mediaInfo.previewUrl,
            viewerUrl: mediaInfo.viewerUrl,
            fullsizeUrl: mediaInfo.fullsizeUrl
        };
        return doc.set('!00.ma', JSON.stringify(val));
    };

    Doc._p.removeMediaContent = function (mediaId) {
        var doc = this;
        if (!doc.has(mediaId + '.ma')) { throw new Error('no media-content found with id="' + mediaId + '"'); }
        return doc.set('!00.md', mediaId);
    };

    /**
     * @returns {Array} list of all media contents inserted into the document
     */
    Doc._p.listAllMediaContent = function () {
        var doc = this;

        var res = [];
        function addMediaInfo(mid, mediaInfo) {
            if (mediaInfo.deleted) {
                return;
            }
            mediaInfo.id = mid;

            if (mediaInfo.mediatype !== 'embed-video') {
                mediaInfo.url = '/yadisk/download?private_hash=' + encodeURIComponent(mediaInfo.hash);
                mediaInfo.previewUrl = '/yadisk/preview?private_hash=' + encodeURIComponent(mediaInfo.hash) + '&size=M';
                mediaInfo.fullsizeUrl = '/yadisk/preview?private_hash=' + encodeURIComponent(mediaInfo.hash) + '&size=ORIGINAL';
            }

            res.push(mediaInfo);
        }

        var pid;
        for (pid = ';03+02'; pid; pid = doc.get(pid + '.pn')) {
            doc.walkParagraphActualMediaContent(pid, addMediaInfo);
        }

        return res;
    };

    papyrus.addFilter('.ma', function (spec, val) {
        var doc = this;
        var id = spcf.get(spec, '!');
        var valParsed = JSON.parse(val);
        var mediaAdd = doc.get(valParsed.pid + '.mA') || '';
        doc.set(valParsed.pid + '.mA', mediaAdd + id);
    });

    papyrus.addFilter('.md', function (spec, mediaIdForDel) {
        var doc = this;
        var id = spcf.get(spec, '!');
        var media = JSON.parse(doc.get(mediaIdForDel + '.ma'));
        var mediaDel = doc.get(media.pid + '.mD') || '';
        doc.set(media.pid + '.mD', mediaDel + id);
    });

    function reset_media_content() {
        var doc = this;
        for (var pid = ';03+02'; pid; pid = doc.get(pid + '.pn')) {
            if (doc.has(pid + '.mA')) doc.reset(pid + '.mA');
        }
    }

    papyrus.addFilter('.BV', reset_media_content);
    papyrus.addFilter('.RL', reset_media_content);
    papyrus.addFilter('.UC', reset_media_content);

    Doc._p.copyMediaContent = function (from_pid, to_pid) {
        var doc = this;
        doc.walkParagraphActualMediaContent(from_pid, function (mid, mediaInfo) {
            if (!mediaInfo.deleted) {
                doc.insertMediaContent(to_pid, mediaInfo);
            }
        });
    };

    var RE_YOUTUBE = /(?:https?:\/\/)(?:www\.)?youtube\.com\/watch\?v=([a-z0-9\-]+)/i;
    var RE_VIMEO = /(?:https?:\/\/)vimeo\.com\/(\d+)/i;

    papyrus.buildVideoContent = function (url, forExport) {
        var m;
        //YouTube
        RE_YOUTUBE.lastIndex = 0;
        m = RE_YOUTUBE.exec(url);
        if (m) {
            return '<iframe width="500" height="281"' +
                    ' src="' + (forExport?'http:':'') + '//www.youtube.com/embed/' + m[1] + '?wmode=opaque"' +
                    ' frameborder="0"' +
                    ' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
        }

        //Vimeo
        RE_VIMEO.lastIndex = 0;
        m = RE_VIMEO.exec(url);
        if (m) {
            return '<iframe width="500" height="281"' +
                    ' src="' + (forExport?'http:':'') + '//player.vimeo.com/video/' + m[1] + '"' +
                    ' frameborder="0"' +
                    ' webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>';
        }

        //TODO other video hosting services

        return null;
    };

    function getMediaCSSClass(media_info) {
        return ((!media_info.added && !media_info.removed && 'old_on') || '') +
                ((media_info.removed && ' rm_on') || '');
    }

    function getPreviewAttrs(doc, mid, pid) {
        var uid = doc.get('!' + spcf.parse(mid).ssn + '.sn');
        var pform = doc.get(pid + '.tr');
        var off_color_uids = doc.get('.UC') || '';
        var preview_attrs = {};
        var p_uid = spcf.get(pform, '@');
        if (!doc.redliningOn && uid !== p_uid &&
                (!off_color_uids || ((off_color_uids.indexOf(p_uid) > -1) ^ (off_color_uids.indexOf(uid) > -1)))) {
            preview_attrs.au = uid;
        }
        return preview_attrs;
    }

    var mediatype2renderer = {
        document: function (mid, media_info, forExport) {
            var doc = this;
            if (forExport) {
                return '<a href="' + '/yadisk/download?private_hash=' + encodeURIComponent(media_info.hash) + '">' + (media_info.filename || 'вложение') + '</a><br />';
            }

            return JST.filecard({
                id: mid,
                'class': getMediaCSSClass(media_info),
                url: '/yadisk/download?private_hash=' + encodeURIComponent(media_info.hash),
                viewerUrl: media_info.viewerUrl,
                mediatype: media_info.mediatype,
                mimetype: media_info.mimetype,
                title: media_info.filename || 'вложение',
                icon: papyrus.getFileIcon(media_info),
                withActions: true,
                attrs: {
                    'data-focus': 'capture'
                },
                preview_attrs: getPreviewAttrs(doc, mid, media_info.pid)
            });
        },
        image: function (mid, media_info, forExport) {
            var doc = this;
            if (forExport) {
                return '<a href="' + '/yadisk/download?private_hash=' + encodeURIComponent(media_info.hash) + '">' + (media_info.filename || 'вложение') + '</a><br />';
            }

            return JST.filecard({
                id: mid,
                'class': getMediaCSSClass(media_info),
                url: '/yadisk/download?private_hash=' + encodeURIComponent(media_info.hash),
                previewUrl: '/yadisk/preview?private_hash=' + encodeURIComponent(media_info.hash) + '&size=M',
                viewerUrl: media_info.viewerUrl,
                mediatype: media_info.mediatype,
                mimetype: media_info.mimetype,
                title: media_info.filename || 'документ',
                icon: papyrus.getFileIcon(media_info),
                withActions: true,
                attrs: {
                    'data-focus': 'capture'
                },
                preview_attrs: getPreviewAttrs(doc, mid, media_info.pid)
            });
        },
        'embed-video': function (mid, media_info, forExport) {
            var doc = this;
            var video_content = papyrus.buildVideoContent(media_info.url, forExport);

            if (!video_content) { return ''; }

            if (forExport) {
                return video_content + '<br />';
            }

            return JST.filecard({
                id: mid,
                'class': 'nb-filecard_video ' + getMediaCSSClass(media_info),
                url: media_info.url,
                content: video_content,
                withActions: true,
                attrs: {
                    'data-focus': 'capture'
                },
                preview_attrs: getPreviewAttrs(doc, mid, media_info.pid)
            });
        }
    };
    papyrus.mediaRenderers = mediatype2renderer;

    /**
     * iterate through paragraph' "live" media-content
     * @param {string} pid paragraph id
     * @param {function(string, {pid, mediatype, mimetype, url, previewUrl, filename})} cb callback
     */
    Doc._p.walkParagraphActualMediaContent = function (pid, cb) {
        var doc = this,
            base_version = spcf.ssnMap(doc.get('.BV') || ''),
            media_remove_list = spcf.split(doc.get(pid + '.mD') || ''),
            old_deleted = [],
            newly_deleted = [],
            i, l, mid;

        for (i = 0, l = media_remove_list.length; i < l; i++) {
            mid = doc.get(media_remove_list[i] + '.md');
            if (!doc.redliningOn) {
                old_deleted.push(mid);
            } else {
                var parsed = spcf.getParsed(media_remove_list[i], '!');
                if (parsed.seq > (base_version[parsed.ssn] || '00')) {
                    newly_deleted.push(mid);
                } else {
                    old_deleted.push(mid);
                }
            }
        }

        spcf.split(doc.get(pid + '.mA') || '').forEach(function (mid) {
            if (old_deleted.indexOf(mid) > -1)  {
                media_info = {'deleted': true};
                cb(mid, media_info);
                return;
            }

            var media_info = doc.get(mid + '.ma');
            if (!media_info) {
                if (papyrus.DEBUG) { console.warn('missing media: pid=', pid, 'mid=', mid); }
                return;
            }

            var mid_parsed = spcf.getParsed(mid, '!');

            media_info = JSON.parse(media_info);
            media_info.removed = newly_deleted.indexOf(mid) > -1;
            media_info.added = !doc.redliningOn || (mid_parsed.seq > (base_version[mid_parsed.ssn] || '00'));

            cb(mid, media_info);
        });
    };

    Doc._p.getMediaBlockHtml = function (pid, forExport) {
        var doc = this;
        var m_html = ['<ul class="mediabox">','<div class="mediaindentbox"></div>'];
        var counter = 0;
        var uidMediaCount = {};
        doc.walkParagraphActualMediaContent(pid, function (mid, mediaInfo) {
            var midParsed = spcf.getParsed(mid, '!');
            var uid = doc.get('!' + midParsed.ssn + '.sn');
            uidMediaCount[uid] = 0;
            if (!mediaInfo.deleted && !mediaInfo.removed) {
                var mediaType = mediaInfo.mediatype || 'document';
                var renderer = mediatype2renderer[mediaType] || mediatype2renderer.document;
                var mediaHtml = renderer.call(doc, mid, mediaInfo, forExport);
                if (!mediaHtml) { return; }
                m_html.push(mediaHtml);
                counter++;
                uidMediaCount[uid]++;
            }
        });
        for (var uid in uidMediaCount) {
            var mediaValue = uidMediaCount[uid] * 100;
            doc.set(uid + pid + '.mc', mediaValue);
        }
        if (!counter) { return ''; }

        m_html.push('</ul>');
        m_html.push('<div style="clear:both;"></div>');
        return m_html.join('').replace(/(<br\s?\/>\s*){2}/, '<br/>');
    };

    var getAntiOperations_text = Doc._p.getAntiOperations;
    Doc._p.getAntiOperations = function (sv) {
        var doc = this;
        var res = [];
        switch (spcf.type(sv.spec)) {

        case '.ma':
            var mid = spcf.get(sv.spec, '!');
            res.push({spec: '!00.md', val: mid});
            break;

        case '.md':
            res.push({spec: '!00.ma', val: doc.get(sv.val + '.ma')});
            break;

        default:
            res = getAntiOperations_text.apply(this, arguments);

        }
        return res;
    };

}((g['papyrus'] = g['papyrus'] || {}), g.JST));
