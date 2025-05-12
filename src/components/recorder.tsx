'use client';

import React, { useState, useRef, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      sendGestureAction: (action: { type: string; x?: number; y?: number }) => void;
    };
  }
}

export default function Recorder() {
    const [recording, setRecording] = useState(false);
    const [videoURL, setVideoURL] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoChunks = useRef<Blob[]>([]);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [topLabel, setTopLabel] = useState<{ label: string; score: number } | null>(null);
  
    const startRecording = async () => {
      setVideoURL(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
  
      // Show live video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
  
      mediaRecorderRef.current = new MediaRecorder(stream);
      videoChunks.current = [];
  
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunks.current.push(event.data);
        }
      };
  
      mediaRecorderRef.current.onstop = () => {
        const videoBlob = new Blob(videoChunks.current, { type: 'video/webm' });
        setVideoURL(URL.createObjectURL(videoBlob));
        // Stop all tracks to release the camera
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
  
      mediaRecorderRef.current.start();
      setRecording(true);
    };
  
    const stopRecording = () => {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      // Pause the live preview
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  
    const handleGestureAction = (label: string) => {
      if (typeof window === 'undefined' || !window.electronAPI) return;
      if (label === 'peace') {
        window.electronAPI.sendGestureAction({ type: 'mouse_move', x: 0, y: 500 });
      } else if (label === 'fist') {
        window.electronAPI.sendGestureAction({ type: 'mouse_click' });
      }
    };
  
    const sendFrameToBackend = async (imageDataUrl: string) => {
      const response = await fetch('http://localhost:8000/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      const data = await response.json();
      // Find the top result
      if (data.result && Array.isArray(data.result) && data.result.length > 0) {
        const top = data.result.reduce((a: { score: number }, b: { score: number }) => (a.score > b.score ? a : b));
        setTopLabel(top);
        handleGestureAction(top.label);
      }
      console.log(data);
    };
  
    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (recording && videoRef.current && canvasRef.current) {
        interval = setInterval(() => {
          const video = videoRef.current!;
          const canvas = canvasRef.current!;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            sendFrameToBackend(dataUrl);
          }
        }, 200); // every 200ms
      }
      return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording]);
  
    // Clean up on unmount
    useEffect(() => {
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    }, []);

    
  
    return (
      <main style={{ padding: 32, minHeight: '100vh', position: 'relative' }}>
        <div className='flex justify-center items-center '>
        <div style={{ margin: '20px 0' }}>
          <video
            ref={videoRef}
            width={500}
            height={375}
            style={{
              border: '1px solid #ccc',
              background: '#000',
              display: recording ? 'block' : 'none',
            }}
            autoPlay
            muted
          />
        </div>
        {videoURL && (
          <div style={{ marginTop: 20 }}>
            <video src={videoURL} controls width={500} height={375} />
            <div>
              <a href={videoURL} download="recording.webm">
                Download recording
              </a>
            </div>
          </div>
        )}
        </div>
        <button
          className='btn btn-primary bg-white text-black rounded-full px-4 py-2 border-2 cursor-pointer'
          onClick={recording ? stopRecording : startRecording}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 140,
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {topLabel && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 220,
              transform: 'translateX(-50%)',
              zIndex: 1001,
              background: 'rgba(255,255,255,0.9)',
              padding: '16px 32px',
              borderRadius: 16,
              fontSize: 24,
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              color: 'black',
            }}
          >
            {topLabel.label} ({(topLabel.score * 100).toFixed(1)}%)
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </main>
    );
  }
  