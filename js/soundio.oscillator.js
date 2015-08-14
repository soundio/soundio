(function(window) {
	"use strict";

	// Require Soundio and AudioObject.
	var Soundio = window.Soundio;
	var AudioObject = window.AudioObject;
	var MIDI = window.MIDI;

	// Alias useful functions
	var assign = Object.assign;

	// Declare some useful defaults
	var defaults = { gain: 1 };

	function UnityNode(audio) {
		var oscillator = audio.createOscillator();
		var waveshaper = audio.createWaveShaper();

		var curve = new Float32Array(2);
		curve[0] = curve[1] = 1;

		oscillator.type = 'square';
		oscillator.connect(waveshaper);
		oscillator.frequency.value = 100;
		waveshaper.curve = curve;
		oscillator.start();

		return waveshaper;
	}

	function spawnOscillator (audio, freq) {
		var oscillatorNode = audio.createOscillator();
		oscillatorNode.type = 'square';
		oscillatorNode.frequency.setValueAtTime(freq, audio.currentTime);
		return oscillatorNode;
	}

	function spawnGain (audio, gain) {
		var gainNode = audio.createGain();
		gainNode.gain.value = Math.pow(gain, 2);
		return gainNode;
	}

	function spawnFilter (audio, freq, time) {
		var filterNode = audio.createBiquadFilter();
		filterNode.frequency.value = freq * 1;
		filterNode.Q.value = 15;
		filterNode.type = 'lowpass';
		filterNode.frequency.exponentialRampToValueAtTime(freq * 3, time + 0.06);
		filterNode.frequency.setTargetAtTime(freq * 1, time + 0.08, 1);
		return filterNode;
	}

	// A Soundio plugin is created with an object constructor.
	// The constructor must create an instance of AudioObject.
	// One way to do this is to use AudioObject as a mix-in.
	function OscillatorSynthAudioObject(audio, settings, clock) {
		var DISCONNECT_AFTER = 5;
		var options = assign({}, defaults, settings);
		var outputNode = audio.createGain();
		// osccache will contain a mapping of number (freq) to an object containing
		// - the oscillator setup for the right frequency
		// - a gain node that will tune the volume based on the velocity
		// osscache = { 40: {
		//		oscillator: {},
		//		gain: {}
		// }
		var unityNode  = UnityNode(audio);
		var pitchNode  = audio.createGain();
		var detuneNode = audio.createGain();
		var osccache   = {};

		pitchNode.gain.value = 0;
		detuneNode.gain.value = 100;
		unityNode.connect(pitchNode);
		pitchNode.connect(detuneNode);

		// Initialise this as an AudioObject.
		AudioObject.call(this, audio, undefined, outputNode, {
			gain: {
				param: outputNode.gain,
				curve: 'linear',
				duration: 0.008
			},

			pitch: {
				param: pitchNode.gain,
				curve: 'linear',
				duration: 0.006
			}
		});

		function createCachedOscillator(number, velocity, time) {
			if (!osccache[number]) {
				var freq = MIDI.numberToFrequency(number);
				var oscillatorNode = spawnOscillator(audio, freq);
				var gainNode = spawnGain(audio, velocity);
				var filterNode = spawnFilter(audio, freq, time);

				detuneNode.connect(oscillatorNode.detune);
				oscillatorNode.connect(filterNode);
				filterNode.connect(gainNode);
				gainNode.connect(outputNode);

				addToCache(number, oscillatorNode, gainNode, filterNode);

				oscillatorNode.start(time);
			}
		}
		function addToCache(number, oscillatorNode, gainNode, filterNode) {
			var cacheEntry = {};
			cacheEntry['oscillator'] = oscillatorNode;
			cacheEntry['gain'] = gainNode;
			cacheEntry['filter'] = filterNode;
			osccache[number] = cacheEntry;
		}
		function stopCachedOscillator(number, time) {
			if (osccache[number]) {
				osccache[number]['oscillator'].stop(time);
			}
		}
		function removeFromCache(number, time) {
			if (osccache[number]) {
				var oscNode = osccache[number]['oscillator'];
				var gainNode = osccache[number]['gain'];
				var filterNode = osccache[number]['filter'];
				// Need to fix the parameters because we empty the cache instantly while
				// we want to disconnect the node only after it has finished playing
				clock.on(time + DISCONNECT_AFTER, (function(osc, gain, detune, filter) {
					return function(time) {
						osc.disconnect();
						gain.disconnect();
						filter.disconnect();
						detune.disconnect(osc.detune);
					};
				})(oscNode, gainNode, detuneNode, filterNode));
				delete osccache[number];
			}
		}

		this.start = function(time, number, velocity) {
			velocity = velocity === undefined ? 0.25 : velocity ;
			createCachedOscillator(number, velocity, time);
		};

		this.stop = function(time, number) {
			stopCachedOscillator(number, time);
			removeFromCache(number, time);
		};

		// Overwrite destroy so that it disconnects the graph
		this.destroy = function() {
			for (var prop in osccache) {
				osccache[prop]['oscillator'].disconnect();
				osccache[prop]['gain'].disconnect();
				delete osccache[prop];
			}
			outputNode.disconnect();
		};
	}

	// Mix AudioObject prototype into MyObject prototype
	assign(OscillatorSynthAudioObject.prototype, AudioObject.prototype);

	// Register the object constructor with Soundio. The last
	// parameter, controls, is optional but recommended if the
	// intent is to make the object controllable, eg. via MIDI.
	Soundio.register('osc', OscillatorSynthAudioObject);
})(window);
