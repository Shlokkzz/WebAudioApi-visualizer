import React, { useRef, useEffect, useState } from "react";
import { Chart, registerables } from "chart.js";
import { arrayBuffer } from "stream/consumers";

Chart.register(...registerables);

const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRefOriginal = useRef<HTMLCanvasElement | null>(null);

  const canvasRefSnapshot = useRef<HTMLCanvasElement | null>(null);
  const canvasRefOriginalSnapshot = useRef<HTMLCanvasElement | null>(null);

  const chartRef = useRef<Chart | null>(null);

  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [audioCtxOriginal, setAudioCtxOriginal] = useState<AudioContext | null>(
    null
  );
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [analyserOriginal, setAnalyserOriginal] = useState<AnalyserNode | null>(
    null
  );
  const [source, setSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const [sourceOriginal, setSourceOriginal] =
    useState<MediaStreamAudioSourceNode | null>(null);

  const [biquadFilter, setBiquadFilter] = useState<BiquadFilterNode | null>(
    null
  );
  const [compressor, setCompressor] = useState<DynamicsCompressorNode | null>(
    null
  );
  const [gainNode, setGainNode] = useState<GainNode | null>(null);
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [compressorEnabled, setCompressorEnabled] = useState(false);

  const [filterType, setFilterType] = useState("lowpass");

  const [visualizationType, setVisualizationType] = useState<
    "sinewave" | "frequencybars"
  >("sinewave");

  // values for filters
  const [filterFrequency, setFilterFrequency] = useState(1000);
  const [filterQuality, setFilterQuality] = useState(1);

  const [threshold, setTreshold] = useState(-24);
  const [knee, setKnee] = useState(30);
  const [ratio, setRatio] = useState(12);
  const [attack, setAttack] = useState(0.03);
  const [release, setRelease] = useState(0.25);

  const [gain, setGain] = useState(1);

  // audio: {
  //   noiseSuppression: true,
  //   echoCancellation: true, // Optional: Enable echo cancellation
  // },

  useEffect(() => {
    const initAudio = async () => {
      try {
        const audioContext = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true, // Optional: Enable echo cancellation
          },
        });
        const sourceNode = audioContext.createMediaStreamSource(stream);
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.minDecibels = -90;
        analyserNode.maxDecibels = -10;
        analyserNode.smoothingTimeConstant = 0.85;

        const biquad = audioContext.createBiquadFilter();
        biquad.type = "lowpass";
        biquad.frequency.setValueAtTime(
          filterFrequency,
          audioContext.currentTime
        );
        biquad.Q.setValueAtTime(filterQuality, audioContext.currentTime);

        const compressorNode = audioContext.createDynamicsCompressor();
        compressorNode.threshold.setValueAtTime(-24, audioContext.currentTime);
        compressorNode.knee.setValueAtTime(30, audioContext.currentTime);
        compressorNode.ratio.setValueAtTime(12, audioContext.currentTime);
        compressorNode.attack.setValueAtTime(0.03, audioContext.currentTime);
        compressorNode.release.setValueAtTime(0.25, audioContext.currentTime);

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(1, audioContext.currentTime);

        sourceNode.connect(analyserNode);
        // biquad.connect(compressorNode);
        // compressorNode.connect(gain);
        // gain.connect(analyserNode);
        analyserNode.connect(audioContext.destination);

        setAudioCtx(audioContext);
        setAnalyser(analyserNode);
        setSource(sourceNode);
        setBiquadFilter(biquad);
        setCompressor(compressorNode);
        setGainNode(gain);

        // original
        const audioContextOriginal = new AudioContext();
        const streamOriginal = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const sourceNodeOriginal = audioContextOriginal.createMediaStreamSource(streamOriginal);
        const analyserNodeOriginal = audioContextOriginal.createAnalyser();
        analyserNodeOriginal.fftSize = 2048;
        analyserNodeOriginal.minDecibels = -90;
        analyserNodeOriginal.maxDecibels = -10;
        analyserNodeOriginal.smoothingTimeConstant = 0.85;

        sourceNodeOriginal.connect(analyserNodeOriginal);
        // analyserNodeOriginal.connect(audioContext.destination);

        setAudioCtxOriginal(audioContextOriginal);
        setAnalyserOriginal(analyserNodeOriginal);
        setSourceOriginal(sourceNodeOriginal);

        console.log("upda");
      } catch (error) {
        console.error("Error initializing audio context:", error);
      }
      updateConnections();
    };

    initAudio();

    return () => {
      if (audioCtx) {
        audioCtx.close();
      }
      if(audioCtxOriginal){
        audioCtxOriginal.close();
      }
    };
  }, []);

  // For processed graph
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

    if (!canvasCtx) return;

    const intendedWidth = 1400; // Set the desired width here
    const intendedHeight = 800; // Set the desired height here

    canvas.setAttribute("width", intendedWidth.toString());
    canvas.setAttribute("height", intendedHeight.toString());

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    let animationId: number;

    const draw = (timestamp: number) => {
      if (!analyser || !canvasCtx) return;

      if (visualizationType === "sinewave") {
        analyser.fftSize = 4096;
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = "rgb(200, 200, 200)";
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.beginPath();
        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      } else if (visualizationType === "frequencybars") {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.fillStyle = "white";
        canvasCtx.font = "12px Arial";
        canvasCtx.fillText("Frequency (Hz)", WIDTH / 2, HEIGHT - 10);
        const barWidth = (WIDTH / bufferLength) * 5;
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] * 6;
          canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
          canvasCtx.fillRect(
            x,
            HEIGHT - barHeight / 2,
            barWidth,
            barHeight / 2
          );
          x += barWidth + 1;
        }
      }
      if (visualizationType === "frequencybars") {
        const step = 20; // Grid step size

        canvasCtx.strokeStyle = "#ddd";

        // Draw grid
        for (let x = 0; x <= WIDTH; x += step) {
          canvasCtx.beginPath();
          canvasCtx.moveTo(x, 0);
          canvasCtx.lineTo(x, HEIGHT);
          canvasCtx.stroke();
          // canvasCtx.fillText(x, x, 10);
        }
        for (let y = 0; y <= HEIGHT; y += step) {
          canvasCtx.beginPath();
          canvasCtx.moveTo(0, y);
          canvasCtx.lineTo(WIDTH, y);
          canvasCtx.stroke();
          // canvasCtx.fillText(y, 0, y + 10);
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [analyser, visualizationType]);

  // For original graph
  useEffect(() => {
    if (!canvasRefOriginal.current) return;

    const canvas = canvasRefOriginal.current;
    const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

    if (!canvasCtx) return;

    const intendedWidth = 1400; // Set the desired width here
    const intendedHeight = 800; // Set the desired height here

    canvas.setAttribute("width", intendedWidth.toString());
    canvas.setAttribute("height", intendedHeight.toString());

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    let animationId: number;

    const draw = (timestamp: number) => {
      if (!analyserOriginal || !canvasCtx) return;

      if (visualizationType === "sinewave") {
        analyserOriginal.fftSize = 4096;
        const bufferLength = analyserOriginal.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        analyserOriginal.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = "rgb(200, 200, 200)";
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.beginPath();
        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      } else if (visualizationType === "frequencybars") {
        const bufferLength = analyserOriginal.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserOriginal.getByteFrequencyData(dataArray);
        canvasCtx.fillStyle = "white";
        canvasCtx.font = "12px Arial";
        canvasCtx.fillText("Frequency (Hz)", WIDTH / 2, HEIGHT - 10);
        const barWidth = (WIDTH / bufferLength) * 5;
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] * 6;
          canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
          canvasCtx.fillRect(
            x,
            HEIGHT - barHeight / 2,
            barWidth,
            barHeight / 2
          );
          x += barWidth + 1;
        }
      }

      if (visualizationType === "frequencybars") {
        const step = 20; // Grid step size

        canvasCtx.strokeStyle = "#ddd";

        // Draw grid
        for (let x = 0; x <= WIDTH; x += step) {
          canvasCtx.beginPath();
          canvasCtx.moveTo(x, 0);
          canvasCtx.lineTo(x, HEIGHT);
          canvasCtx.stroke();
          // canvasCtx.fillText(x, x, 10);
        }
        for (let y = 0; y <= HEIGHT; y += step) {
          canvasCtx.beginPath();
          canvasCtx.moveTo(0, y);
          canvasCtx.lineTo(WIDTH, y);
          canvasCtx.stroke();
          // canvasCtx.fillText(y, 0, y + 10);
        }
      }
      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [analyserOriginal, visualizationType]);

  // Function to apply a filter based on type
  // const applyFilter = (type: BiquadFilterType) => {
  //   if (!audioCtx || !source || !analyser) return;

  //   if (filter) {
  //     filter.disconnect();
  //   }

  //   const newFilter = audioCtx.createBiquadFilter();
  //   newFilter.type = type;
  //   newFilter.frequency.setValueAtTime(filterFrequency, audioCtx.currentTime); // Use state value
  //   newFilter.Q.setValueAtTime(filterQuality, audioCtx.currentTime); // Use state value

  //   source.disconnect();
  //   source.connect(newFilter);
  //   newFilter.connect(analyser);
  //   analyser.connect(audioCtx.destination);

  // };

  const applyFilter = (type: BiquadFilterType) => {
    if (biquadFilter) {
      biquadFilter.type = type;
      setFilterType(type);
    }
  };

  const updateConnections = () => {
    console.log(filterEnabled, compressorEnabled);
    if (!audioCtx || !source || !analyser) return;

    if (audioCtx) {
      source.disconnect();
      if (filterEnabled && compressorEnabled) {
        source.connect(biquadFilter!);
        biquadFilter!.connect(compressor!);
        compressor!.connect(gainNode!);
      } else if (filterEnabled) {
        source.connect(biquadFilter!);
        biquadFilter!.connect(gainNode!);
      } else if (compressorEnabled) {
        source.connect(compressor!);
        compressor!.connect(gainNode!);
      } else {
        source.connect(gainNode!);
      }
      gainNode!.connect(analyser!);
      analyser!.connect(audioCtx.destination);
    }
  };

  // Function to check if a filter type is active
  const isActiveFilter = (type: BiquadFilterType) => filterType === type;

  // CSS for active filter button
  const buttonStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? "#28a745" : "#007BFF",
    color: "white",
    border: "none",
    padding: "10px 20px",
    marginRight: "10px",
    cursor: "pointer",
    borderRadius: "4px",
    outline: "none",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
  });

  const filterButton = (isActive: boolean) => ({
    backgroundColor: isActive ? "red" : "#28a745",
    color: "white",
    border: "none",
    padding: "10px 20px",
    marginRight: "10px",
    cursor: "pointer",
    borderRadius: "4px",
    outline: "none",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
  });
  const handleVisualizationChange = (type: "sinewave" | "frequencybars") => {
    setVisualizationType(type);
  };

  const handleSnapshot = () => {
    console.log("CLICKED");
    const originalCanvas = canvasRefOriginal.current;
    const mixedCanvas = canvasRef.current;
    const snapshotOriginalCanvas = canvasRefOriginalSnapshot.current;
    const snapshotMixedCanvas = canvasRefSnapshot.current;

    if (
      originalCanvas &&
      mixedCanvas &&
      snapshotOriginalCanvas &&
      snapshotMixedCanvas
    ) {
      const ctxOriginal = originalCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const ctxMixed = mixedCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const ctxSnapshotOriginal = snapshotOriginalCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const ctxSnapshotMixed = snapshotMixedCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      // Get the image data from both original canvases
      const originalImageData = ctxOriginal!.getImageData(
        0,
        0,
        originalCanvas.width,
        originalCanvas.height
      );
      const mixedImageData = ctxMixed!.getImageData(
        0,
        0,
        mixedCanvas.width,
        mixedCanvas.height
      );

      // Set the size of snapshot canvases to match original canvases if they are different
      snapshotOriginalCanvas.width = originalCanvas.width;
      snapshotOriginalCanvas.height = originalCanvas.height;
      snapshotMixedCanvas.width = mixedCanvas.width;
      snapshotMixedCanvas.height = mixedCanvas.height;

      ctxSnapshotOriginal!.putImageData(originalImageData, 0, 0);
      ctxSnapshotMixed!.putImageData(mixedImageData, 0, 0);
    }
  };

  const handleToggleFilter = () => {
    setFilterEnabled((prev) => !prev);
  };

  const handleToggleCompressor = () => {
    setCompressorEnabled((prev) => !prev);
  };

  useEffect(() => {
    updateConnections();
  }, [filterEnabled, compressorEnabled, gain]);

  const resetValues = () => {
    biquadFilter!.frequency.value = 1000;
    setFilterFrequency(biquadFilter!.frequency.value);

    biquadFilter!.Q.value = 1;
    setFilterQuality(biquadFilter!.Q.value);

    compressor!.threshold.value = -24;
    setTreshold(compressor!.threshold.value);

    compressor!.knee.value = 30;
    setKnee(compressor!.knee.value);

    compressor!.ratio.value = 12;
    setRatio(compressor!.ratio.value);

    compressor!.attack.value = 0.03;
    setAttack(compressor!.attack.value);

    compressor!.release.value = 0.25;
    setRelease(compressor!.release.value);

    gainNode!.gain.value = 1;
    setGain(gainNode!.gain.value);
  };

  // JSX for filter buttons
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center", margin: "10px", marginTop: "30px" }}>
          <p
            style={{
              fontWeight: "bold",
              marginBottom: "5px",
              fontSize: "18px",
            }}
          >
            Original Audio
          </p>
          <canvas
            ref={canvasRefOriginal}
            style={{
              maxWidth: "100%",
              // border: "1px solid black",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ textAlign: "center", margin: "10px", marginTop: "30px" }}>
          <p
            style={{
              fontWeight: "bold",
              marginBottom: "5px",
              fontSize: "18px",
            }}
          >
            Processed Audio
          </p>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: "100%",
              // border: "1px solid black",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          paddingBottom: "100px",
        }}
      >
        <div
          style={{
            padding: "10px",
            display: "inline-block",
          }}
        >
          <button
            onClick={() => handleVisualizationChange("sinewave")}
            style={buttonStyle(visualizationType === "sinewave")}
          >
            Sine-wave
          </button>
          <button
            onClick={() => handleVisualizationChange("frequencybars")}
            style={buttonStyle(visualizationType === "frequencybars")}
          >
            Frequency-bar
          </button>
        </div>

        {/*  buttons filter */}
        <p
          style={{
            fontWeight: "bold",
            marginBottom: "5px",
            fontSize: "30px",
            marginTop: "50px",
          }}
        >
          BIQUAD FILTER
        </p>
        <button
          onClick={handleToggleFilter}
          style={filterButton(filterEnabled)}
        >
          {filterEnabled ? "Disable Filter" : "Enable Filter"}
        </button>

        <div style={{ marginTop: "20px" }}>
          <button
            style={buttonStyle(isActiveFilter("lowpass"))}
            onClick={() => applyFilter("lowpass")}
          >
            Low-pass Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("highpass"))}
            onClick={() => applyFilter("highpass")}
          >
            High-pass Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("bandpass"))}
            onClick={() => applyFilter("bandpass")}
          >
            Band-pass Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("lowshelf"))}
            onClick={() => applyFilter("lowshelf")}
          >
            Low-shelf Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("highshelf"))}
            onClick={() => applyFilter("highshelf")}
          >
            High-shelf Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("peaking"))}
            onClick={() => applyFilter("peaking")}
          >
            Peaking Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("notch"))}
            onClick={() => applyFilter("notch")}
          >
            Notch Filter
          </button>
          <button
            style={buttonStyle(isActiveFilter("allpass"))}
            onClick={() => applyFilter("allpass")}
          >
            All-pass Filter
          </button>
        </div>

        <div style={{ marginTop: "20px" }}>
          <label>
            Frequency:
            <input
              type="range"
              min="20"
              max="20000"
              // value={filterFrequency}
              value={biquadFilter ? biquadFilter.frequency.value : 1000}
              // onChange={(e) => setFilterFrequency(parseFloat(e.target.value))}
              onChange={(e) => {
                if (biquadFilter) {
                  biquadFilter.frequency.value = parseFloat(e.target.value);
                  setFilterFrequency(biquadFilter.frequency.value);
                }
              }}
              onMouseUp={(e) => {
                if (biquadFilter) {
                  biquadFilter.frequency.value = parseFloat(
                    (e.target as HTMLInputElement).value
                  );
                }
              }}
              style={{ width: "300px", margin: "0 10px" }}
            />
            {filterFrequency} Hz
          </label>
        </div>
        <div style={{ marginTop: "10px" }}>
          <label>
            Q Factor:
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              // value={filterQuality}
              value={biquadFilter ? biquadFilter.Q.value : 1}
              // onChange={(e) => setFilterQuality(parseFloat(e.target.value))}
              onChange={(e) => {
                biquadFilter!.Q.value = parseFloat(e.target.value);
                setFilterQuality(biquadFilter!.Q.value);
              }}
              onMouseUp={(e) => {
                if (biquadFilter) {
                  biquadFilter!.Q.value = parseFloat(
                    (e.target as HTMLInputElement).value
                  );
                }
              }}
              style={{ width: "300px", margin: "0 10px" }}
            />
            {filterQuality.toFixed(2)}
          </label>
          <br />
        </div>

        {/* ADDED */}
        <p
          style={{
            fontWeight: "bold",
            marginBottom: "5px",
            fontSize: "30px",
            marginTop: "50px",
          }}
        >
          COMPRESSOR NODE
        </p>
        <button
          onClick={handleToggleCompressor}
          style={filterButton(compressorEnabled)}
        >
          {compressorEnabled ? "Disable Filter" : "Enable Filter"}
        </button>
        <br />
        <br />
        <label>
          Threshold:
          <input
            type="range"
            min="-100"
            max="0"
            value={compressor ? compressor.threshold.value : -24}
            onChange={(e) => {
              if (compressor)
                compressor.threshold.value = parseFloat(e.target.value);
              setTreshold(compressor!.threshold.value);
            }}
            onMouseUp={(e) => {
              if (compressor) {
                compressor.threshold.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {threshold} dB
        </label>
        <br />
        <label>
          Knee:
          <input
            type="range"
            min="0"
            max="40"
            value={compressor ? compressor.knee.value : 30}
            onChange={(e) => {
              if (compressor)
                compressor.knee.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              setKnee(compressor!.knee.value);
            }}
            onMouseUp={(e) => {
              if (compressor) {
                compressor.knee.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {knee} dB
        </label>
        <br />
        <label>
          Ratio:
          <input
            type="range"
            min="1"
            max="20"
            value={compressor ? compressor.ratio.value : 12}
            onChange={(e) => {
              if (compressor)
                compressor.ratio.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              setRatio(compressor!.ratio.value);
            }}
            onMouseUp={(e) => {
              if (compressor) {
                compressor.ratio.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {ratio}
        </label>
        <br />
        <label>
          Attack:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={compressor ? compressor.attack.value : 0.03}
            onChange={(e) => {
              if (compressor)
                compressor.attack.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              setAttack(compressor!.attack.value);
            }}
            onMouseUp={(e) => {
              if (compressor) {
                compressor.attack.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {attack.toFixed(2)} ms
        </label>
        <br />
        <label>
          Release:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={compressor ? compressor.release.value : 0.25}
            onChange={(e) => {
              if (compressor)
                compressor.release.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              setRelease(compressor!.release.value);
            }}
            onMouseUp={(e) => {
              if (compressor) {
                compressor.release.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {release.toFixed(2)} ms
        </label>

        <br />
        <p
          style={{
            fontWeight: "bold",
            marginBottom: "5px",
            fontSize: "30px",
            marginTop: "50px",
          }}
        >
          GAIN NODE
        </p>
        <br />
        <label>
          Gain:
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={gainNode ? gainNode.gain.value : 0.25}
            onChange={(e) => {
              if (gainNode)
                gainNode.gain.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              setGain(gainNode!.gain.value);
            }}
            onMouseUp={(e) => {
              if (gainNode) {
                gainNode.gain.value = parseFloat(
                  (e.target as HTMLInputElement).value
                );
              }
            }}
            style={{ width: "300px", margin: "0 10px" }}
          />
          {gain.toFixed(2)}
        </label>
        <br />

        <button
          style={{
            backgroundColor: "#FA2A55",
            color: "white",
            border: "none",
            padding: "10px 20px",
            marginRight: "10px",
            cursor: "pointer",
            borderRadius: "4px",
            outline: "none",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
          }}
          onClick={() => resetValues()}
        >
          RESET VALUES
        </button>
        <br />
        <br />
        <button
          style={{
            backgroundColor: "orange",
            color: "white",
            border: "none",
            padding: "10px 20px",
            marginRight: "10px",
            cursor: "pointer",
            borderRadius: "4px",
            outline: "none",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
          }}
          onClick={() => handleSnapshot()}
        >
          Snapshot
        </button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p
          style={{
            fontWeight: "bold",
            marginBottom: "5px",
            fontSize: "30px",
            marginTop: "50px",
          }}
        >
          SNAPSHOTS
        </p>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center", margin: "10px", marginTop: "30px" }}>
          <p
            style={{
              fontWeight: "bold",
              marginBottom: "5px",
              fontSize: "18px",
            }}
          >
            Original Audio
          </p>
          <canvas
            ref={canvasRefOriginalSnapshot}
            style={{
              maxWidth: "100%",
              // border: "1px solid black",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ textAlign: "center", margin: "10px", marginTop: "30px" }}>
          <p
            style={{
              fontWeight: "bold",
              marginBottom: "5px",
              fontSize: "18px",
            }}
          >
            Processed Audio
          </p>
          <canvas
            ref={canvasRefSnapshot}
            style={{
              maxWidth: "100%",
              // border: "1px solid black",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      <br />
      <br />
      <br />
    </div>
  );
};

export default Visualizer;
