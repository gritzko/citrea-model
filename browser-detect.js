//noinspection JSHint,JSLint
(function (papyrus) {
    //  C O N S T A N T S

    papyrus.isMac = navigator.appVersion.indexOf("Mac") != -1;
    papyrus.isIE = (navigator.appName == "Microsoft Internet Explorer");
    if (papyrus.isIE) { // yesss
        papyrus.ieVer = navigator.appVersion.match(/MSIE (\d+)/) || '0';
        papyrus.ieVer = parseInt(papyrus.ieVer, 10);
        document.documentElement.classList.add('ie');
    }
    papyrus.isOpera = !!navigator.userAgent.match('Opera');
    if (papyrus.isOpera) {
        var m;
        if (m = navigator.userAgent.match(/Version\/([.\d]+)/)) {
            if (parseFloat(m[1]) < 13) {
                document.documentElement.classList.add('opera12');
            }
        }
    }
    papyrus.isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
    papyrus.isSafari = (navigator.vendor || '').indexOf("Apple") > -1;
    papyrus.isWin = navigator.platform.indexOf('Win') > -1;

    papyrus.isIphone = !!navigator.userAgent.match(/iPhone/i);
    papyrus.isIpad = !!navigator.userAgent.match(/iPad/i);
    papyrus.isIpod = !!navigator.userAgent.match(/iPod/i);
    papyrus.isIos = papyrus.isIphone || papyrus.isIpad || papyrus.isIpod;

    papyrus.KEYBOARD = {
        PAGE_UP : 33,
        PAGE_DOWN : 34,
        END : 35,
        HOME : 36,
        LEFT : 37,
        UP : 38,
        RIGHT : 39,
        DOWN : 40,
        COMMAND : 91,
        CONTROL : 17,
        TAB : 9,
        ESC : 27,
        ENTER : 13,
        BACKSPACE : 8,
        DELETE : 46,
        SPACE : 32,
        ASTERISK : 42,
        QUESTION : 63,
        SEMICOLON : papyrus.isFirefox ? 59 : 186,
        APOSTROPHE : 222,
        TILDA: 192
    };

    var i;
    for (i = 0x41; i <= 0x5a; i++) {
        papyrus.KEYBOARD[String.fromCharCode(i)] = i;
    }
    for (i = 0; i < 10; i++) {
        papyrus.KEYBOARD['_' + i] = i + 48;
    }

    //noinspection JSHint,JSLint
    if (papyrus.isIE && !(window['console'])) {
        var wc = {};
        wc.log = wc.warn = wc.fail = function () {};
        window.console = wc;
    }

}(window['papyrus'] = window['papyrus'] || {}));