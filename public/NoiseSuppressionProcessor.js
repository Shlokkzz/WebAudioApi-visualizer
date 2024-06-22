// import { AudioWorkletProcessor } from 'standardized-audio-context';
// import x from "../node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.mjs";

// err - 
import  createRNNWasmModuleSync   from './rnnoise-wasm/dist/rnnoise-sync';
import { leastCommonMultiple } from './math';
import RnnoiseProcessor from './rnnoise/RnnoiseProcessor';

// build left

class NoiseSuppressorWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this._denoiseProcessor = null;
      
        this._procNodeSampleRate = 128;
      
        this._denoiseSampleSize = 0;
      
        this._circularBufferLength = 0;
      
        this._circularBuffer = null;
      
        this._inputBufferLength = 0;
      
        this._denoisedBufferLength = 0;
      
        this._denoisedBufferIndx = 0;

        this._initializeRNNoise();

        
    // this._rnnoise =  null;
    // this._denoiseState = null;
    // this.port.onmessage = this._onMessage.bind(this);
    // this._initializeRNNoise();

    }
    
    async _initializeRNNoise() {
      //   try {
      //   // this._rnnoise = await Rnnoise.load({assetsPath:`${window.location.origin}/`});
      //   this._denoiseState = this._rnnoise?.createDenoiseState();
      // } catch (error) {
      //   console.error('Error initializing RNNoise:', error);
      // }

      this._denoiseProcessor = new RnnoiseProcessor(createRNNWasmModuleSync());
      this._denoiseSampleSize = this._denoiseProcessor.getSampleLength();
  
      this._circularBufferLength = leastCommonMultiple(this._procNodeSampleRate, this._denoiseSampleSize);
      this._circularBuffer = new Float32Array(this._circularBufferLength);
  }

  // _onMessage(event) {
  //   console.log("Message from noise: ",event);
  //   if(event.data.type === "rnnoise_module"){
  //     this._rnnoise = event.data.rnnoise;
  //     this._initializeRNNoise();
  //   }
  // }

  process(inputs, outputs, parameters) {
    // if (!this._rnnoise || !this._denoiseState) return true; 

    // const input = inputs[0];
    // const output = outputs[0];

    // for (let channel = 0; channel < input.length; ++channel) {
    //   const floatFrame = new Float32Array(input[channel]);
    //   this._rnnoise?.processFrame(this._denoiseState, floatFrame);
    //   output[channel].set(floatFrame);
    // }


    const inData = inputs[0][0];
    const outData = outputs[0][0];

    if (!inData) {
        return true;
    }

    // buffering and processing logic

    this._circularBuffer.set(inData, this._inputBufferLength);
    this._inputBufferLength += inData.length;

    for (; this._denoisedBufferLength + this._denoiseSampleSize <= this._inputBufferLength;
        this._denoisedBufferLength += this._denoiseSampleSize) {

        const denoiseFrame = this._circularBuffer.subarray(
            this._denoisedBufferLength,
            this._denoisedBufferLength + this._denoiseSampleSize
        );

        this._denoiseProcessor.processAudioFrame(denoiseFrame, true);
    }

    let unsentDenoisedDataLength;

    if (this._denoisedBufferIndx > this._denoisedBufferLength) {
        unsentDenoisedDataLength = this._circularBufferLength - this._denoisedBufferIndx;
    } else {
        unsentDenoisedDataLength = this._denoisedBufferLength - this._denoisedBufferIndx;
    }

    if (unsentDenoisedDataLength >= outData.length) {
        const denoisedFrame = this._circularBuffer.subarray(
            this._denoisedBufferIndx,
            this._denoisedBufferIndx + outData.length
        );

        outData.set(denoisedFrame, 0);
        this._denoisedBufferIndx += outData.length;
    }

    if (this._denoisedBufferIndx === this._circularBufferLength) {
        this._denoisedBufferIndx = 0;
    }

    if (this._inputBufferLength === this._circularBufferLength) {
        this._inputBufferLength = 0;
        this._denoisedBufferLength = 0;
    }

    return true;
  }
}

registerProcessor('noise-suppressor-worklet', NoiseSuppressorWorklet);