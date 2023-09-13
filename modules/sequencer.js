
import arg      from '../../fn/modules/arg.js';
import by       from '../../fn/modules/by.js';
import get      from '../../fn/modules/get.js';
import id       from '../../fn/modules/id.js';
import matches  from '../../fn/modules/matches.js';
import overload from '../../fn/modules/overload.js';
import Privates from '../../fn/modules/privates.js';

import Event       from './event.js';
import Clock       from './clock.js';
import FrameStream from './sequencer/frame-stream.js';
import Meter       from './sequencer/meter.js';
import Sequence, { by0Float32 } from './sequencer/sequence.js';

import { print } from './print.js';
import { getDejitterTime }   from './context.js';
import Playable, { IDLE, PLAYING } from './playable.js';
import { automate, getValueAtTime } from './automate.js';
import { isRateEvent, getDuration, isValidEvent, eventValidationHint } from './event.js';
import { timeAtBeatOfEvents } from './sequencer/location.js';
import parseEvents from './events/parse-events.js';

const assign = Object.assign;
const create = Object.create;
const define = Object.defineProperties;


function getDejitter(context) {
    return context.getOutputTimestamp().contextTime
        + context.outputLatency
        // Sample block compensation - IS THIS NEED? TEST!
        + 128 / context.sampleRate ;
}



/**
Sequencer()

```js
// Clock
.context
.startTime
.startLocation
.stopTime
.start()
.stop()

// Sequencer
startTime:  number || undefined
stopTime:   number || undefined
status:     idle || playing || done
transport:  object

// Meter methods
beatAtBar:  fn(n)
barAtBeat:  fn(n)
```
**/

export default function Sequencer(transport, output, events = [], sequences = []) {
    // .context
    // .startTime
    // .startLocation
    // .stopTime
    // .start()
    // .stop()
    Playable.call(this, transport.context);

    this.transport = transport;
    this.events    = typeof evente === 'string' ?
        parseEvents(events) :
        events.sort(by0Float32) ;
    this.sequences = sequences;
    this.rate      = transport.outputs.rate.offset;

    const privates = Privates(this);
    privates.beat   = 0;
    privates.output = output;
}

assign(Sequencer.prototype, Meter.prototype, {
    beatAtTime: function(time) {
        const transport     = this.transport;
        const startLocation = this.startLocation
           || (this.startLocation = transport.beatAtTime(this.startTime)) ;
        return transport.beatAtTime(time) - startLocation;
    },

    timeAtBeat: function(beat) {
        const transport     = this.transport;
        const startLocation = this.startLocation
           || (this.startLocation = transport.beatAtTime(this.startTime)) ;
        return transport.timeAtBeat(startLocation + beat);
    },

    /**
    .start(time, beat)
    Starts the sequencer at `time` to play on `beat`, returning a PlayStream.
    **/
    start: function(time = getDejitterTime(this.context), beat) {
        const { transport } = this;

        // If the sequencer is running stop it first
        if (this.status !== IDLE) { this.stop(time); }

        // Delegate timing to playable
        Playable.prototype.start.call(this, time);

        if (window.DEBUG) {
            print('Sequencer start()', 'startTime', this.startTime, 'transport', transport.status);
        }

        const privates = Privates(this);

        if (transport.status !== PLAYING) {
            console.log('TRAN START', transport.status);
            transport.start(time, beat);
        }
/*        if (transport.status === PLAYING) {
            console.log('A', time);
            // If transport is running set start time to next beat
            time = transport.timeAtBeat(Math.ceil(transport.beatAtTime(time)));
            console.log('B', time);
        }
        else {
            // Otherwise start transport at time
            transport.start(time, beat);
            //time = transport.startTime;
        }
*/
        // TODO: Clock stuff?? IS THIS NEEDED?
        this.startLocation = undefined;

        privates.sequence = new FrameStream(this.context)
            // Pipe frames to sequence. Parameter 4 is just a name for debugging.
            .pipe(new Sequence(this, this.events, this.sequences, 'root'))
            // Error-check and consume output events
            .map(overload(arg(1), {
                'note':     (event) => { throw new Error('note events should have been converted to start and stop here'); },
                'sequence': (event) => { throw new Error('sequence events should have been consumed by the sequencer here'); },
                'param':    (event) => { throw new Error('param events should have been renamed by the sequencer here'); },

                'start':    (event) => {
                    console.log('SSTTAARRART', event);
                    return event;
                },

                'stop':     (event) => {
                    console.log('SSTTSTTSTOOOOPPP');
                    if (!event.startEvent) { throw new Error('stopEvent with missing startEvent'); }
                    event.target = event.startEvent.target.stop(event[0], event[2]);
                },

                'log':      (event) => {
                    console.log(this.context.currentTime.toFixed(3), event[0].toFixed(3), event[2]);
                },

                default: id
            }))
            // Distribute to output stream
            .each((event) => {
                //console.log('OUT      ', event[0].toFixed(3), event[2], event[1]);
                // Automation should return a target. This may be dodgy.
                event.target = privates.output.push(event);

                if (!event.target) {
                    console.log('No target returned for', event[1], event);
                }

                return event.target;
            })
            // Start sequence
            .start(this.startTime);

        return this;
    },

    /**
    .stop(time)
    Stops the sequencer at `time`, stopping all child sequence streams.
    **/
    stop: function(time) {
        const privates = Privates(this);

        // Ought to be this.time TODO
        time = time || this.context.currentTime;

        // Set this.stopTime
        Playable.prototype.stop.call(this, time);

        if (window.DEBUG) {
            print('Sequencer stop() ', 'stopTime ', this.stopTime, 'status', this.status);
        }

        // Hold automation for the rate node
        // param, time, curve, value, duration, notify, context
        automate(this.rate, this.stopTime, 'hold', null, null, privates.notify, this.context);

        // Store beat
        privates.beat = this.beatAtTime(this.stopTime);

        // Stop sequence
        privates.sequence.stop(this.stopTime);

        // Stop transport ???
        this.transport.stop(this.stopTime);

        return this;
    }
});

define(Sequencer.prototype, {
    /**
    .bar
    The current bar count.
    **/
    bar: {
        get: function() { return this.barAtBeat(this.beat) ; }
    },

    /** .beat
    The current beat count.
    **/
    beat: {
        get: function() {
            const privates = Privates(this);
            if (this.startTime === undefined
                || this.startTime >= this.context.currentTime
                || this.stopTime < this.context.currentTime) {
                return privates.beat;
            }

            return this.beatAtTime(this.time);
        },

        set: function(value) {
            const privates = Privates(this);

            if (this.startTime === undefined
                || this.stopTime < this.context.currentTime) {
                privates.beat = value;
                // Todo: update state of entire graph with evented settings for
                // this beat   ... wot? Oh snapshot cuurent state to Graph. Ah.
            }
            else {
                // Sequence is started - can we move the beat? Ummm... I don't thunk so...
                throw new Error('Beat cannot be moved while sequencer is running');
            }
        }
    },

    /** .meter
    The current meter.
    **/
    meter: {
        get: function() {
            const { transport } = Privates(this);
            return transport.getMeterAtTime(this.context.currentTime);
        },

        set: function(meter) {
            const { transport } = Privates(this);
            transport.setMeterAtTime(meter, this.context.currentTime)
        }
    },

    /** .tempo
    The rate of the transport clock expressed in bpm.
    **/
    tempo: {
        get: function() { return getValueAtTime(this.rate, this.time) * 60; },
        set: function(tempo) { automate(this.rate, this.time, 'step', tempo / 60, null, privates.notify, this.context); }
    },

    /** .time
    The time of audio now leaving the device output. (In browsers the have not
    yet implemented `AudioContext.getOutputTimestamp()` this value is estimated
    from `currentTime` and a guess at the output latency. Which is a bit meh,
    but better than nothing.)
    **/
    time: {
        get: function() {
            return this.context.getOutputTimestamp().contextTime;
        }
    },

    status: Object.getOwnPropertyDescriptor(Playable.prototype, 'status')
});
