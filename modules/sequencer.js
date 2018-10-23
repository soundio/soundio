
/*
.start(time, beat)

Starts the sequencer from `beat` at `time`.
*/

/*
.stop(time)

Stops the sequencer `time`.
*/

/*
.cue(beat, fn)

Cues `fn` to be called on beat.
*/

/*
.beatAtTime(time)

Returns the beat at a given `time`.
*/

/*
.timeAtBeat(beat)

Returns the time at a given `beat`.
*/

import { each, get, id, insert, isDefined, Pool } from '../../fn/fn.js';
import { default as Sequence, log as logSequence } from './sequence.js';
import { getPrivates } from './utilities/privates.js';
import { createId } from './utilities/utilities.js';
import Transport from './transport.js';
import Clock from './clock.js';
import CueStream from './cue-stream.js';
import CueTimer from './cue-timer.js';
import Location from './location.js';
import Meter from './meter.js';
import Events from '../../fn/js/eventz.js';

var DEBUG     = window.DEBUG;

var assign    = Object.assign;
var define    = Object.defineProperties;
var notify    = Events.notify;


// Sequencer
//
// A singleton, Sequencer is a persistent, reusable wrapper for Cuestreams
// and RecordStreams, which are read-once. It is the `master` object from
// whence event streams sprout.

export default function Sequencer(audio, distributors, sequences, events) {

	// Transport is the base clock. It inherits from Clock and it provides
	// these methods and properties:
	//
	// rate:           param
	// tempo:          number
	// startTime:      number || undefined
	// stopTime:       number || undefined
	// start:          fn
	// stop:           fn
	// beatAtTime:     fn
	// timeAtBeat:     fn
	// locationAtBeat: fn
	// beatAtLocation: fn
	//
	// It also puts rateNode into privates

	Transport.call(this, audio);

	// Mix in Meter
	//
	// beatAtBar:  fn(n)
	// barAtBeat:  fn(n)

	Meter.call(this, events);

	// Mix in Location
	//
	// beatAtLoc:  fn(n)
	// locAtBeat:  fn(n)
	//
	//Location.call(this, events);

	// Initialise sequencer as an event emitter
	//
	// on:  fn
	// off: fn
	//
	//Events.call(this);

	const timer = new CueTimer(function now() { return audio.currentTime; });

	// Private

	const privates  = getPrivates(this);
	const sequencer = this;

	privates.startTime = 0;
	privates.beat = 0;

	function init() {
		var stream = new CueStream(timer, sequencer, sequencer.events, id, distributors);
		// Ensure there is always a stream waiting by preparing a new
		// stream when the previous one ends.
		stream.on({ 'stop': reset });
		privates.stream = stream;
	}

	function reset(time) {
		var beat = sequencer.beatAtTime(time);
		init();
	}


	// Public

	this.start = function(time, beat) {
		time = time || this.context.currentTime;

		var stream = privates.stream;
		var status = stream.status;

		// If stream is not waiting, stop it and start a new one
		if (status !== 'waiting') {
			this.stop(time);
			return this.start(time, beat);
		}

		Clock.prototype.start.call(this, time, beat);

		//var startTime = privates.startTime = time !== undefined ?
		//	time :
		//	audio.currentTime ;

console.log('Sequencer: start()', this.startTime, beat, status, audio.state);

		if (typeof beat === 'number') {
			privates.beat = beat;
		}

		var events = sequencer.events;

		//clock.start(this.startTime);
		stream.start(this.startTime, privates.beat);
		notify('start', this.startTime, this);

		return this;
	};

	this.stop = function(time) {
		var stream = privates.stream;
		var status = stream.status;

		console.log('Sequencer: stop() ', time, status);

		// If stream is not yet playing do nothing
		if (status === 'waiting') { return this; }

		var stopTime = time || audio.currentTime ;
		privates.beat = stream.beatAtTime(stopTime);

		notify('stop', stopTime, this);
		stream.stop(stopTime);

		Clock.prototype.stop.call(this, time);

		// Log the state of Pool shortly after stop
		if (DEBUG) {
			setTimeout(function() {
				logSequence(sequencer);
				console.log('Pool –––––––––––––––––––––––––––––––––');
				console.table(Pool.snapshot());
			}, 400);
		}

		return this;
	};


	// Init playback

	init();
}

assign(Sequencer.prototype, Transport.prototype, Meter.prototype, Events.prototype, {
	//create: function(generator, object) {
	//	var stream = this[$private].stream;
	//	return stream.create(generator, id, object);
	//},

	cue: function(beat, fn) {
		var stream = getPrivates(this).stream;
		stream.cue(beat, fn);
		return this;
	},

	/*
	beatAtTime: function(time) {
		var stream = this[$private].stream;
		return stream ? stream.beatAtTime(time) : undefined ;
	},

	timeAtBeat: function(beat) {
		var stream = this[$private].stream;
		return stream ? stream.timeAtBeat(beat) : undefined ;
	}
	*/
});
