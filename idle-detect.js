//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint
(function (papyrus) {

    papyrus.isIdle = false;
    function setIdle(val) {
        papyrus.emit('idle', val);
        papyrus.isIdle = val;
    }

    var setIdleTrue = setIdle.bind(this, true);

    var idleTimer = false;
    function resetIdleTimer() {
        if (papyrus.isIdle) {
            setIdle(false);
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(setIdleTrue, papyrus.config.clientConfig.timeBeforeIdle);
    }


    document.addEventListener('keydown', resetIdleTimer);
    document.addEventListener('mousedown', resetIdleTimer);
    document.addEventListener('mousemove', resetIdleTimer);

    resetIdleTimer();

}(g.papyrus || (g.papyrus = {})));

