//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {
    var types = {
        // иконка по-умолчанию
        'default': 'none',
        // иконка вирусного файла
        'virus': 'virus',

        // иконка по медиатипу, пришедшего из MPFS
        mediatypes: {
            'image': 'image',
            'audio': 'audio',
            'video': 'video',
            'archive': 'archive',
            'text': 'text',
            'font': 'font',
            'executable': 'application',
            'flash': 'flash',
            'development': 'development',
            'book': 'book',
            'compressed': 'archive'
        },

        // иконка по расширению файла
        extnames: {
            // архивы
            '.7z'       : 'archive',
            '.cab'      : 'archive',
            '.gz'       : 'archive',
            '.gzip'     : 'archive',
            '.rar'      : 'rar',
            '.tar'      : 'archive',
            '.zip'      : 'zip',
            '.zipx'     : 'zip',

            // аудио
            '.aud'      : 'audio',
            '.flac'     : 'audio',
            '.iff'      : 'audio',
            '.m3u'      : 'audio',
            '.m3u8'     : 'audio',
            '.m4a'      : 'audio',
            '.m4b'      : 'audio',
            '.m4r'      : 'audio',
            '.mp3'      : 'mp3',
            '.pls'      : 'pls',
            '.ogg'      : 'audio',
            '.wav'      : 'wav',
            '.wma'      : 'wma',

            // видео
            '.asf'      : 'video',
            '.avi'      : 'avi',
            '.flv'      : 'flash',
            '.mov'      : 'mov',
            '.mp4'      : 'mp4',
            '.mpeg'     : 'video',
            '.mkv'      : 'video',
            '.mpg'      : 'video',
            '.srt'      : 'srt',
            '.swf'      : 'flash',
            '.vob'      : 'video',
            '.wmv'      : 'wmv',

            // изображения
            '.ai'       : 'ai',
            '.cur'      : 'image',
            '.bmp'      : 'bmp',
            '.dng'      : 'image',
            '.djvu'     : 'djvu',
            '.ico'      : 'image',
            '.gif'      : 'gif',
            '.jpg'      : 'jpg',
            '.jpeg'     : 'jpg',
            '.png'      : 'png',
            '.psd'      : 'psd',
            '.pcx'      : 'pcx',
            '.mng'      : 'image',
            '.tif'      : 'tiff',
            '.tiff'     : 'tiff',
            '.xcf'      : 'image',

            // книги
            '.epub'     : 'book',
            '.ibooks'   : 'book',
            '.mobi'     : 'book',
            '.fb2'      : 'book',

            // документы
            '.cdr'      : 'cdr',
            '.csv'      : 'csv',
            '.doc'      : 'doc',
            '.docx'     : 'doc',
            '.dot'      : 'doc',
            '.dotx'     : 'doc',
            '.indd'     : 'text',
            '.key'      : 'text',
            '.odt'      : 'odt',
            '.odp'      : 'odp',
            '.pdf'      : 'pdf',
            '.pps'      : 'text',
            '.ppsm'     : 'text',
            '.ppsx'     : 'text',
            '.ppt'      : 'ppt',
            '.pptx'     : 'ppt',
            '.ods'      : 'ods',
            '.rtf'      : 'rtf',
            '.txt'      : 'txt',
            '.xls'      : 'xls',
            '.xlsb'     : 'xls',
            '.xlsx'     : 'xls',
            '.xltm'     : 'xls',
            '.xltx'     : 'xls',
            '.xps'      : 'text',

            // скрипты
            '.css'      : 'development',
            '.htm'      : 'development',
            '.html'     : 'development',
            '.js'       : 'development',
            '.php'      : 'development',
            '.xhtml'    : 'development',
            '.htaccess' : 'development',
            '.mso'      : 'development',
            '.asm'      : 'development',
            '.asp'      : 'development',
            '.aspx'     : 'development',
            '.c'        : 'development',
            '.cgi'      : 'development',
            '.class'    : 'development',
            '.cpp'      : 'development',
            '.dtd'      : 'development',
            '.h'        : 'development',
            '.java'     : 'development',

            // исполняемые файлы
            '.apk'      : 'application',
            '.bat'      : 'application',
            '.com'      : 'application',
            '.exe'      : 'exe',
            '.gadget'   : 'application',
            '.jar'      : 'application'
        }
    };

    papyrus.getFileIcon = function (mediaInfo) {
        var filename = mediaInfo.filename,
            mediatype = mediaInfo.mediatype,
            ext, icon;

        if (filename) {
            var dots = filename.split('.');
            if (dots.length > 1 && dots[dots.length - 1]) {
                ext = '.' + dots[dots.length - 1];
            }
        }

        if (ext && types.extnames[ext]) {
            icon = types.extnames[ext];
        } else if (mediatype && types.mediatypes[mediatype]) {
            icon = types.mediatypes[mediatype];
        } else {
            icon = types['default'];
        }

        return icon;
    };
}(g['papyrus'] = g['papyrus'] || {}));
