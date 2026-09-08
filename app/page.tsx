'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Enter text and click Generate to begin');
  const [noiseScale, setNoiseScale] = useState(0.667);
  const [lengthScale, setLengthScale] = useState(1.0);
  const [noiseW, setNoiseW] = useState(0.8);
  const [emotion, setEmotion] = useState('auto');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setStatus('Please enter some text');
      return;
    }

    setIsLoading(true);
    setStatus('Generating speech...');
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          noiseScale,
          lengthScale,
          noiseW,
          emotion,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setStatus('Playback complete');
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setStatus('Error during playback');
      };

      await audio.play();
      setIsPlaying(true);

      const durationMs = response.headers.get('X-Duration-Ms');
      const sampleRate = response.headers.get('X-Sample-Rate');
      const detectedEmotion = response.headers.get('X-Emotion');
      const confidence = response.headers.get('X-Emotion-Confidence');
      setStatus(
        `Playing ${detectedEmotion ? `${detectedEmotion}${confidence ? ` (${Math.round(parseFloat(confidence) * 100)}%)` : ''}` : ''} - ${durationMs ? `${(parseInt(durationMs) / 1000).toFixed(1)}s` : ''} @ ${sampleRate || '22050'}Hz`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setStatus('Stopped');
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
        setStatus('Resumed');
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        setStatus('Paused');
      }
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>VITS TTS Generator</h1>
        <p>Self-hosted text-to-speech using ONNX inference</p>
      </header>

      <div className="tts-card">
        <div className="input-group">
          <label htmlFor="text-input">Text to speak</label>
          <textarea
            id="text-input"
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
          />
        </div>

        <div className="controls">
          <div className="control-group">
            <label htmlFor="emotion">Emotion delivery</label>
            <select
              id="emotion"
              className="slider"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
            >
              <option value="auto">Auto-detect (AI)</option>
              <option value="happy">Happy</option>
              <option value="excited">Excited — louder, faster</option>
              <option value="angry">Angry — louder, slower</option>
              <option value="sad">Sad — slower, deeper</option>
              <option value="emotional">Emotional — slower, lower</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
          <div className="control-group">
            <label>Noise Scale: {noiseScale.toFixed(3)}</label>
            <div className="slider-container">
              <input
                type="range"
                className="slider"
                min="0"
                max="1"
                step="0.001"
                value={noiseScale}
                onChange={(e) => setNoiseScale(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="control-group">
            <label>Speed: {lengthScale.toFixed(2)}x</label>
            <div className="slider-container">
              <input
                type="range"
                className="slider"
                min="0.5"
                max="2"
                step="0.01"
                value={lengthScale}
                onChange={(e) => setLengthScale(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="control-group">
            <label>Noise W: {noiseW.toFixed(3)}</label>
            <div className="slider-container">
              <input
                type="range"
                className="slider"
                min="0"
                max="1"
                step="0.001"
                value={noiseW}
                onChange={(e) => setNoiseW(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? 'Generating...' : 'Generate Speech'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handlePause}
            disabled={!isPlaying}
          >
            Pause
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleStop}
            disabled={!isPlaying}
          >
            Stop
          </button>
        </div>

        <div className={`status ${isPlaying ? 'playing' : ''} ${status.startsWith('Error') ? 'error' : ''}`}>
          {status}
        </div>

        <div className="voices-info">
          <h3>Model: VITS Piper (en_GB-cori-medium)</h3>
          <p>
            Running locally via ONNX Runtime. No external API calls. First request may take a few seconds to load the model.
          </p>
        </div>
      </div>
    </div>
  );
}
