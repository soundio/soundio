
import id       from '../../fn/modules/id.js';
import Privates from '../../fn/modules/privates.js';
import Stream   from '../../fn/modules/stream.js';

import { roundBeat } from './utilities.js';
import { automate, getValueAtTime, getAutomation } from './automate.js';
import { barAtBeat, beatAtBar } from './meter.js';
//import { isRateEvent } from './event.js';
import { connect, disconnect } from './connect.js';
import { beatAtTimeOfAutomation, timeAtBeatOfAutomation } from './location.js';
import Clock from './clock.js';

/**
Transport(context, rateParam, notify)
TODO: Why is timer here? it doesnt appear to do anything transport-y
**/

const assign = Object.assign;
const define = Object.defineProperties;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

const defaultRateEvent  = Object.freeze({ time: 0, value: 2, curve: 'step', beat: 0 });
const defaultMeterEvent = Object.freeze({ 0: 0, 1: 'meter', 2: 4, 3: 1 });

export default function Transport(context, rateParam, notify) {
    Clock.call(this, context, notify);

    // Private
    const privates = Privates(this);
    privates.rateParam = rateParam;
    privates.meters = [defaultMeterEvent];
    privates.notify = notify;
    privates.sequenceCount = 0;
}

assign(Transport.prototype, Clock.prototype, {
    beatAtTime: function(time) {
        if (time < 0) { throw new Error('Location: beatAtLoc(loc) does not accept -ve values.'); }

        const { rateParam } = Privates(this);
        const events    = getAutomation(rateParam);
        // Cache startLocation as it is highly likely to be needed again
        //console.log('transport.beatAtTime', this.startTime, defaultRateEvent, events);
        const startBeat = this.startLocation || (this.startLocation = beatAtTimeOfAutomation(events, defaultRateEvent, this.startTime));
        const timeBeat  = beatAtTimeOfAutomation(events, defaultRateEvent, time);

        return roundBeat(timeBeat - startBeat);
    },

    timeAtBeat: function(beat) {
        if (beat < 0) { throw new Error('Location: locAtBeat(beat) does not accept -ve values.'); }

        const privates  = Privates(this);
        const events    = getAutomation(privates.rateParam);
        // Cache startLocation as it is highly likely to be needed again
        const startBeat = this.startLocation || (this.startLocation = beatAtTimeOfAutomation(events, defaultRateEvent, this.startTime));

        return timeAtBeatOfAutomation(events, defaultRateEvent, startBeat + beat);
    },

    beatAtBar: function(bar) {
        const privates = Privates(this);
        const meters   = privates.meters;
        return beatAtBar(meters, bar);
    },

    barAtBeat: function(beat) {
        const privates = Privates(this);
        const meters   = privates.meters;
        return barAtBeat(meters, beat);
    },

    rateAtTime: function(time) {
        return getValueAtTime(Privates(this).rateParam);
    },

    setMeterAtBeat: function(beat, bar, div) {
        const privates = Privates(this);
        const meters   = privates.meters;

        // Shorten meters to time
        let n = -1;
        while (++n < meters.length) {
            if (meters[n][0] >= beat) {
                meters.length = n;
                break;
            }
        }

        meters.push({ 0: beat, 1: 'meter', 2: bar, 3: div });
        return true;
    },

    getMeterAtTime: function(time) {
        const { meters } = Privates(this);
        const beat = this.beatAtTime(time);

        let n = -1;
        while(++n < meters.length && meters[n][0] <= beat);
        console.log(time, beat, n, meters[n]);
        return meters[n - 1];
    },

    sequence: function(toEventsBuffer) {
        const privates = Privates(this);
        ++privates.sequenceCount;

        return Frames
        .from(this.context)
        .map((frame) => {
            // Filter out frames before startTime
            if (frame.t2 <= this.startTime) {
                return;
            }

            // If this.stopTime is not undefined or old
            // and frame is after stopTime
            if (this.stopTime > this.startTime
                && frame.t1 >= this.stopTime) {
                return;
            }

            // Trancate b1 to startTime and b2 to stopTime
            frame.b1 = this.beatAtTime(frame.t1 < this.startTime ? this.startTime : frame.t1);
            frame.b2 = this.beatAtTime(this.stopTime > this.startTime && frame.t2 > this.stopTime ? this.stopTime : frame.t2);

            return frame;
        })
        .map(toEventsBuffer)
        .flatMap(id)
        .map((event) => {
            event.time = this.timeAtBeat(event[0]);
            return event;
        })
        .done(() => --privates.sequenceCount);
    },

    // Todo: work out how stages are going to .connect(), and
    // sort out how to access rateParam (which comes from Transport(), BTW)
    connect: function(target, outputName, targetChan) {
        return outputName === 'rate' ?
            connect(Privates(this).rateParam, target, 0, targetChan) :
            connect() ;
    },

    disconnect: function(outputName, target, outputChan, targetChan) {
        if (outputName !== 'rate') { return; }
        if (!target) { return; }
        disconnect(Privates(this).rateParam, target, 0, targetChan);
    }
});

define(Transport.prototype, {
    status: getOwnPropertyDescriptor(Clock.prototype, 'status'),

    beat: {
        get: function() {
            return this.playing ?
                this.beatAtTime(this.context.currentTime) :
                0 ;
        }
    },

    bar: {
        get: function() {
            return this.playing ?
                this.barAtBeat(this.beat) :
                0 ;
        }
    },

    tempo: {
        get: function() {
            return getValueAtTime(this.context.currentTime, this.rate.value) * 60;
        },

        set: function(tempo) {
            var privates = Privates(this);

            //getValueAtTime(this.rate, context.currentTime);
            // param, time, curve, value, duration, notify, context
            automate(this.rate.value, this.context.currentTime, 'step', tempo / 60, 0, privates.notify, this.context);
        }
    },

    // Duration of one process cycle. At 44.1kHz this works out just
    // shy of 3ms.

    blockDuration: {
        get: function() {
            return 128 / this.context.sampleRate;
        }
    },

    frameDuration: {
        get: function() {
                console.log('TODO: REPAIR frameDuration');
    //        return Privates(this).timer.duration;
        }
    },

    frameLookahead: {
        get: function() {
            console.log('TODO: REPAIR frameLookahead');
    //        return Privates(this).timer.lookahead;
        }
    }
});
