//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSHint,JSLint
(function (papyrus) {
    "use strict";

    require('./spcf');
    var spcf = papyrus.spcf;

    function Monkey(doc, text, delay, at) {
        at = at || ';03+02:03+02';
        //noinspection JSLint
        var symbols = text.match(/.|\n/g).reverse();
        var interval = setInterval(function () {
            var symb = symbols.pop();
            if (symb === '\n') { symbols.push('', ''); }
            if (symb === '') { return; }

            // console.log(symb, at);
            doc.insertText(at, symb);
            var pos = spcf.get(doc.ins, '!').replace('!', ':');
            var pid = symb === '\n' ? pos.replace(':', ';') : spcf.get(at, ';');
            at = pid + pos;
            if (!symbols.length) {
                clearInterval(interval);
            }
        }, delay);
    }

    papyrus.Monkey = Monkey;

}(g['papyrus'] = g['papyrus'] || {}));