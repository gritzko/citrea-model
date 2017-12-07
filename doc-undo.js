//noinspection JSLint
var g = typeof global === 'undefined' ? window : global;

//noinspection JSLint,JSHint,ThisExpressionReferencesGlobalObjectJS
(function (papyrus) {
    require('./spcf');

    var spcf = papyrus.spcf;
    var Doc = papyrus.Doc;

    //TODO prod: what size limit editStack should have?
    var UNDO_STACK_SIZE_LIMIT = 50;

    Doc._p.undo = function () { doUndoRedo(this, false); };
    Doc._p.redo = function () { doUndoRedo(this, true); };

    function initDocUndoRedo(doc) {
        //TODO think: what about using svbuf for stack?
        doc.undoData = {
            eventStackUndo: [],
            eventStackRedo: [],
            undoRedoInProgress: false,
            editFlag: false,
            cursorMoved: false,
            lastCursorPosition: null
        };
    }

    function doUndoRedo(doc, isRedo) {
        var undoData = doc.undoData;
        var fromStack, toStack;
        if (isRedo) {
            fromStack = undoData.eventStackRedo;
            toStack = undoData.eventStackUndo;
        } else {
            fromStack = undoData.eventStackUndo;
            toStack = undoData.eventStackRedo;
        }
        if (undoData.undoRedoInProgress) { return; }
        if (!fromStack.length) { return; } //nothing to undo/redo

        undoData.undoRedoInProgress = true;
        doc.disableEditing();
        try {
            var eventOps = fromStack.pop();
            var antiOps = [];
            //generate anti-operations
            while (eventOps.length) {
                var sv = eventOps.pop();
                Array.prototype.push.apply(antiOps, doc.getAntiOperations(sv));
            }

            antiOps.cursor = doc.get('.se');
            doc.set('.se', eventOps.cursor);

            //apply anti-ops
            var i, len;
            for (i = 0, len = antiOps.length; i < len; i++) {
                var anti = antiOps[i];
                var id = doc.set(anti.spec, anti.val);
                if (spcf.has(anti.spec, '!')) {
                    anti.spec = spcf.replace(anti.spec, '!00', spcf.get(id, '!'));
                }
            }
            //add anti-ops for possible redo
            toStack.push(antiOps);
        } finally {
            undoData.undoRedoInProgress = false;
            doc.enableEditing();
            doc.reset('.se');
            notifyUndoRedoStatus(doc);
        }
    }

    function pushNextEditEvent(spec, val) {
        var doc = this;
        var undoData = doc.undoData;
        //skip if position not actually changed
        if (undoData.lastCursorPosition === val) { return; }

        undoData.lastCursorPosition = val;
        //skip cursor movements caused by text-editing
        if (undoData.editFlag) {
            undoData.editFlag = false;
            return;
        }
        undoData.cursorMoved = true;
    }

    function notifyUndoRedoStatus(doc) {
        var undoData = doc.undoData;
        papyrus.emit('undoStackChanged', doc, undoData.eventStackUndo.length, undoData.eventStackRedo.length);
    }

    function addEventToEditHistory(spec, val) {
        var doc = this;
        var undoData = doc.undoData;
        if (undoData.undoRedoInProgress) { return; } //skip events generated during undo/redo

        var serial = spcf.getParsed(spec, '!');
        if (!serial || serial.ssn !== doc.ssn) { return; } //not this session changes

        undoData.editFlag = true;
        spec = spcf.as(spec);
        var type = spcf.type(spec);
        if (undoData.cursorMoved || //after moving cursor
                !undoData.eventStackUndo.length || //when undo-stack is empty
                type === '.at' || //on formatting
                type === '.ma' || type === '.md' || //on media add/del
                (type === '.in' && (val === ' ' || val === '\n'))) {//on "spaces"
            undoData.eventStackUndo.push([]); //create new undo-stack item
        }
        var eventOps = undoData.eventStackUndo[undoData.eventStackUndo.length - 1];

        if (!eventOps.length) {
            // save cursor where it was before insert
            eventOps.cursor = doc.get('.se');
        }
        eventOps.push({spec: spec, val: val});

        //not allow redo after input been made
        undoData.eventStackRedo = [];
        undoData.cursorMoved = false;

        if (undoData.eventStackUndo.length > UNDO_STACK_SIZE_LIMIT) {
            undoData.eventStackUndo.splice(0, undoData.eventStackUndo.length - UNDO_STACK_SIZE_LIMIT);
        }

        notifyUndoRedoStatus(doc);
    }
    papyrus.addEventToEditHistory = addEventToEditHistory;

    papyrus.on('docInit', initDocUndoRedo);

    papyrus.addFilter('.se', pushNextEditEvent);
    papyrus.addFilter('.at', addEventToEditHistory);
    papyrus.addFilter('.in', addEventToEditHistory);
    papyrus.addFilter('.rm', addEventToEditHistory);
    papyrus.addFilter('.ud', addEventToEditHistory);

    papyrus.addFilter('.ma', addEventToEditHistory);
    papyrus.addFilter('.md', addEventToEditHistory);

}(g['papyrus'] = g['papyrus'] || {}));