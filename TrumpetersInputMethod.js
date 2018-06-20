function Kursor(score, kursor) {
	Cursor.call(this, score);
	this.score = score;
	
	if (kursor === null) {
		this.init();
	} else {
		this.goTo(kursor);
	}
}

Kursor.prototype = Object.create(Cursor.prototype);
Kursor.prototype.constructor = Kursor;

Kursor.prototype.init = function() {
	this.staff = 0;
	this.voice = 0;
	this.rewind();
};

Kursor.prototype.next = function() {
	do {
		Cursor.prototype.next.call(this);
	} while (!this.isChord() && !this.isRest() && !this.eos());
};

Kursor.prototype.goTo = function(kursor) {
	this.staff = kursor.staff;
	this.voice = kursor.voice;
	this.rewind();
	
	while (!this.pos().equals(kursor.pos())) {
		this.next();
	}
};

Kursor.prototype.prev = function() {
	var kursor = new Kursor(this.score, null);
	kursor.staff = this.staff;
	kursor.voice = this.voice;
	kursor.rewind();
	var count = -1;
	
	while (!kursor.pos().equals(this.pos())) {
		kursor.next();
		count++;
	}
	
	if (count == -1) {
		return;
	}
	
	this.rewind();
	
	for (var i = 0; i < count; i++) {
		this.next();
	}
};

Kursor.prototype.get = function() {
	if (this.isChord()) {
		return this.chord();
	} else if (this.isRest()) {
		return this.rest();
	}
};

Kursor.prototype.getCopy = function() {
	if (this.isChord()) {
		var chord = new Chord(this.score);
		chord.tickLen = this.chord().tickLen;
		
		for (var i = 0; i < this.chord().notes; i++) {
			var note = new Note(this.score);
			note.pitch = this.chord().note(i).pitch;
			chord.addNote(note);
		}
		
		return chord;
	} else if (this.isRest()) {
		var rest = new Rest(this.score);
		rest.tickLen = this.rest().tickLen;
		return rest;
	}
};

Kursor.prototype.maxTickLen = function() {
	var kursor = new Kursor(this.score, this)
	var tickLen = 0;
	
	do {
		tickLen += kursor.get().tickLen
		kursor.next();
	} while (!kursor.eos() && kursor.measure().pos().equals(this.measure().pos()));
	
	return tickLen;
};

Kursor.prototype.set = function(chordRest) {
	var maxTickLen = this.maxTickLen();
	
	if (chordRest.tickLen > maxTickLen) {
		chordRest.tickLen = maxTickLen;
	}
	
	this.add(chordRest);
};

function Mark(score, kursor, tickLen) {
	this.score = score;
	this.kursor = kursor;
	this.tickLen = tickLen;
	this.origs = [];
	this.show();
}

Mark.prototype.pitch = 60;

Mark.prototype.show = function() {
	var kursor = new Kursor(this.score, this.kursor);
	var tickLen = 0;

	do {
		var orig = kursor.getCopy();
		this.origs.push(orig);
		tickLen += orig.tickLen;
		kursor.next();
	} while (!kursor.eos() && tickLen < this.tickLen);
	
	var note = new Note(this.score);
	note.pitch = this.pitch;
	note.color = new QColor(255, 0, 0);
	var chord = new Chord(this.score);
	chord.tickLen = this.tickLen;
	chord.addNote(note);
	this.kursor.set(chord);
};

Mark.prototype.hide = function() {
	var orig = this.origs.shift();
	this.kursor.set(orig);
	var kursor = new Kursor(this.score, this.kursor);
	kursor.next();
	
	while (this.origs.length > 0) {
		orig = this.origs.shift();
		kursor.set(orig);
		kursor.next();
	}
};

function Window(score, scoreView) {
	var help = '\
Make a blue-box selection by Shift+Click,\n\
then click this window to start entering notes/rests\n\
from the beginning of the selection.\n\
\n\
To add a note, hold valve keys and press a harmonics key\n\
 Valve keys: Alt, Ctrl, Shift\n\
 Harmonics keys: 1, 2, 3, 4, 5, 6, 7, 8, 9\n\
\n\
R: add Rest\n\
E: Extend the length of previous note\n\
D: Decrease the length of previous note\n\
W: Widen unit length by double\n\
S: Shorten unit length by half\
';
	QLabel.call(this, help, scoreView, Qt.Dialog);
	this.score = score;
	this.scoreView = scoreView;
	this.unitTickLen = 240;
	this.windowTitle = 'Trumpeter\'s Input Method';//
	this.defaultKursor = new Kursor(this.score, null);
	this.focusPolicy = Qt.StrongFocus;//
	this.setFocus(Qt.ActiveWindowFocusReason);
}

Window.prototype = Object.create(QLabel.prototype);
Window.prototype.constructor = Window;
Window.prototype.basePitch = 60;

Window.prototype.repaintScoreView = function() {
	this.scoreView.endDrag();
};

Window.prototype.focusInEvent = function(event) {
	var kursor = new Kursor(this.score, null);
	kursor.goToSelectionStart();
	
	if (kursor.eos()) {
		kursor = this.defaultKursor;
	}
	
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
	this.repaintScoreView();
};

Window.prototype.focusOutEvent = function(event) {
	if (!('mark' in this)) {
		return;
	}
	
	this.defaultKursor = this.mark.kursor;
	this.mark.hide();
	delete this.mark;
	this.repaintScoreView();
};

Window.prototype.getValveOffset = function(modifiers) {
	var valves = [
		{modifier: Qt.AltModifier, offset: -2},
		{modifier: Qt.ControlModifier, offset: -1},
		{modifier: Qt.ShiftModifier, offset: -3}
	];

	var valveOffset = 0;
	
	for (var i = 0; i < valves.length; i++) {
		if (modifiers & valves[i].modifier) {
			valveOffset += valves[i].offset;
		}
	}
	
	return valveOffset;
};

Window.prototype.addNote = function (pitch) {
	var note = new Note(this.score);
	note.pitch = pitch;
	var chord = new Chord(this.score);
	chord.tickLen = this.unitTickLen;
	chord.addNote(note);
	var kursor = this.mark.kursor;
	kursor.set(chord);
	kursor.next();
	
	if (kursor.eos()) {
		delete this.mark;
		this.close();
		this.repaintScoreView();
		return;
	}
	
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.addRest = function () {
	var rest = new Rest(this.score);
	rest.tickLen = this.unitTickLen;
	var kursor = this.mark.kursor;
	kursor.set(rest);
	kursor.next();
	
	if (kursor.eos()) {
		delete this.mark;
		this.close();
		this.repaintScoreView();
		return;
	}
	
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.extend = function() {
	var kursor = this.mark.kursor;
	kursor.prev();
	var chordRest = kursor.getCopy();
	chordRest.tickLen += this.unitTickLen;
	kursor.set(chordRest);
	kursor.next();
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.decrease = function() {
	var kursor = this.mark.kursor;
	this.mark.hide();
	kursor.prev();
	var chordRest = kursor.getCopy();
	
	if (chordRest.tickLen <= this.unitLen) {
		this.mark = new Mark(this.score, kursor, this.unitTickLen);
		return;
	}
	
	chordRest.tickLen -= this.unitTickLen;
	kursor.set(chordRest);
	kursor.next();
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.widen = function() {
	if (this.unitTickLen == 1920) {
		return;
	}
	
	var kursor = this.mark.kursor;
	this.mark.hide();
	this.unitTickLen *= 2;
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.shorten = function() {
	if (this.unitTickLen == 30) {
		return;
	}
	
	var kursor = this.mark.kursor;
	this.mark.hide();
	this.unitTickLen /= 2;
	this.mark = new Mark(this.score, kursor, this.unitTickLen);
};

Window.prototype.keyPressEvent = function(event) {
	var harmonicsKeys = {
		'1': 0, '!': 0,
		'2': 7, '@': 7,
		'3': 12, '#': 12,
		'4': 16, '$': 16,
		'5': 19, '%': 19,
		'6': 24, '^': 24,
		'7': 28, '&': 28,
		'8': 31, '*': 31,
		'9': 36, '(': 36
	};
	
	var keys = {
		'r': this.addRest,
		'e': this.extend,
		'd': this.decrease,
		'w': this.widen,
		's': this.shorten
	}
	
	var key = event.text().toLowerCase();
	var modifiers = event.modifiers();
	
	if (key in harmonicsKeys) {
		var valveOffset = this.getValveOffset(modifiers);
		this.addNote(this.basePitch + harmonicsKeys[key] + valveOffset);
		this.repaintScoreView();
	} else if (key in keys) {
		keys[key].call(this);
		this.repaintScoreView();
	}
};

function getCurScoreView() {
	var widgets = QApplication.allWidgets();
	
	for (var i = 0; i < widgets.length; i++) {
		if ('startNoteEntry' in widgets[i] && widgets[i].visible == true) {
			return widgets[i];
		}
	}
}

var mscorePlugin = {};
mscorePlugin.menu = 'Plugins.Trumpeter\'s Input Method';
mscorePlugin.init = function() {};
	
mscorePlugin.run = function() {
	var curScoreView = getCurScoreView();
	var window = new Window(curScore, curScoreView);
	window.show();
};

mscorePlugin;
