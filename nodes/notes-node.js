
//import AudioObject from '../../context-object/modules/context-object.js';
import { logGroup, logGroupEnd } from './print.js';
import { Privates } from '../../fn/module.js';
import NodeGraph from './node-graph.js';
import Pool from '../modules/pool.js';
import { getSink } from '../modules/context.js';

const DEBUG = window.DEBUG;
const assign = Object.assign;
const define = Object.defineProperties;

export const config = {
	tuning: 440
};

const graph = {
	nodes: [
        { id: 'sink',       type: 'sink' },
		{ id: 'expression', type: 'constant', data: { offset: 0 } },
		{ id: 'pitch',      type: 'constant', data: { offset: 0 } },
		{ id: 'detune',     type: 'gain',     data: { gain: 100 } },
		{ id: 'frequency',  type: 'constant', data: { offset: 120 } },
		{ id: 'Q',          type: 'constant', data: { offset: 0.707 } },
		{ id: 'output',     type: 'gain',     data: {
			channelInterpretation: 'speakers',
			channelCountMode: 'explicit',
			channelCount: 2,
			gain: 1
		}}
	],

	connections: [
		{ source: 'pitch',      target: 'detune' },
        { source: 'expression', target: 'sink' },
        { source: 'pitch',      target: 'sink' },
        { source: 'frequency',  target: 'sink' },
        { source: 'Q',          target: 'sink' }
	]
};

const properties = {
	"detune": { enumerable: true, writable: true }
};

function isDefined(val) {
	return val !== undefined && val !== null;
}

function isIdle(node) {
	return node.startTime !== undefined && node.context.currentTime > node.stopTime;
}

export default function NotesNode(context, settings, Voice, setup) {
	if (DEBUG) { logGroup(new.target === NotesNode ? 'Node' : 'mixin ', 'NotesNode'); }

	// Graph
	NodeGraph.call(this, context, graph);

	// Private
	const privates = Privates(this);

	// Properties
	define(this, properties);

	let filterType;

	define(this, {
		filterType: {
			enumerable: true,

			get: function() {
				return filterType;
			},

			set: function(type) {
				filterType = type;
				privates.voices.forEach((note) => {
					if (!note.startTime) { return; }
					if (note.stopTime < note.context.currentTime) { return; }
					note.filter.type = filterType
				});
			}
		},

		numberOfOutputs: {
			value: this.get('output').numberOfOutputs
		}
	});

	const expression = this.get('expression');
	const pitch      = this.get('pitch');
	const frequency  = this.get('frequency');
	const q          = this.get('Q');
	const output     = this.get('output');

	// Start them
	expression.start();
	pitch.start();
	frequency.start();
	q.start();

	this.expression = expression.offset;
	this.pitch      = pitch.offset;
	this.frequency  = frequency.offset;
	this.Q          = q.offset;
	this.volume     = output.gain;

	// Note pool
	privates.voices = new Pool(Voice, isIdle, setup);

	if (DEBUG) { logGroupEnd(); }
}

// Mix AudioObject prototype into MyObject prototype
assign(NotesNode.prototype, NodeGraph.prototype, {
	start: function(time, note, velocity = 1) {
		const privates = Privates(this);

		// Use this as the settings object
		// Todo: is this wise? Dont we want the settings object?
		const voice = privates.voices.create(this.context, this);

		if (!note) {
			throw new Error('Attempt to .start() a note without passing a note value.')
		}

		return voice.start(time, note, velocity);
	},

	stop: function(time, number, velocity = 1) {
		const privates = Privates(this);

		time = time || this.context.currentTime;

		// Stop all notes
		if (!isDefined(number)) {
			privates.voices.forEach(() => {
				note.stop(time, velocity);
			});

			return this;
		}

		const note = privates.voices.find((note) => {
			return note.name === number && note.startTime !== undefined && note.stopTime === undefined;
		});

		if (note) {
			note.stop(time, number, velocity);
		}

		return this;
	},

	destroy: function() {
		this.get('expression').disconnect();
		this.get('pitch').disconnect();
		this.get('frequency').disconnect();
		this.get('Q').disconnect();
		this.get('output').disconnect();
	}
});
