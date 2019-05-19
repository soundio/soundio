
// Todo: decide what to do with simple constructors like envelope... load em,
// or force node-graph to work with promises... I don't think so. Load em for
// the moment.

import Meter    from '../nodes/meter.js';
import Mix      from '../nodes/mix.js';
import Envelope from '../nodes/envelope.js';
import Tick     from '../nodes/tick.js';
import Recorder from '../nodes/recorder.js';

export default {
    // https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/AnalyserNode
    'analyser': AnalyserNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/AudioBufferSourceNode
    'buffer-source': AudioBufferSourceNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/BiquadFilterNode
    'filter': BiquadFilterNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/ConstantSourceNode/ConstantSourceNode
    'constant': ConstantSourceNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode/ConvolverNode
    'convolver': ConvolverNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/DelayNode/DelayNode
    'delay': DelayNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode/DynamicsCompressorNode
    'compressor': DynamicsCompressorNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/GainNode/GainNode
    'gain': GainNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/IIRFilterNode/IIRFilterNode
    'iir-filter': IIRFilterNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaElementAudioSourceNode/MediaElementAudioSourceNode
    'element': MediaElementAudioSourceNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioSourceNode/MediaStreamAudioSourceNode
    'media-source': MediaStreamAudioSourceNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/ChannelMergerNode
    'merger': ChannelMergerNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode/OscillatorNode
    'oscillator': OscillatorNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/PannerNode
    'panner': PannerNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/ChannelSplitterNode/ChannelSplitterNode
    'splitter': ChannelSplitterNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode/WaveShaperNode
    'waveshaper': WaveShaperNode,
    // https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode/StereoPannerNode
    'pan': StereoPannerNode,

    // ../nodes/meter.js
    'meter': Meter,
    // ../nodes/mix.js
    'mix': Mix,
    // ../nodes/envelope.js
    'envelope': Envelope,
    // ../nodes/tick.js
    'tick': Tick,
    // ../nodes/recorder.js
    'recorder': Recorder
};
