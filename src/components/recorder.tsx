'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

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
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  
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

  
    useEffect(() => {
      // Load the hand landmarker model once
      const loadModel = async () => {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
          numHands: 2,
          runningMode: "VIDEO",
        });
      };
      loadModel();
    }, []);
  
    const sendHandPosition = (x: number, y: number) => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const screenX = Math.round((1 - x) * window.screen.width);
        const screenY = Math.round(y * window.screen.height);
        window.electronAPI.sendGestureAction({ type: 'mouse_move', x: screenX, y: screenY });
      }
    };
  
    const drawKeypoints = (landmarks: number[][][]) => {
      const canvas = overlayCanvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "red";
      landmarks.forEach((hand: number[][]) => {
        hand.forEach((point: number[]) => {
          ctx.beginPath();
          ctx.arc(point[0] * canvas.width, point[1] * canvas.height, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
        // Send wrist position (landmark 0) to Electron for mouse movement
        if (hand[0]) {
          sendHandPosition(hand[0][0], hand[0][1]);
        }
      });
    };
  
    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (recording && videoRef.current && overlayCanvasRef.current && handLandmarkerRef.current) {
        interval = setInterval(async () => {
          const video = videoRef.current!;
          // Only run detection if video is ready and has size
          if (
            !handLandmarkerRef.current ||
            video.readyState < 2 || // HAVE_CURRENT_DATA
            video.videoWidth === 0 ||
            video.videoHeight === 0
          ) {
            return;
          }
          const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());
          if (results.landmarks) {
            // Convert NormalizedLandmark[][] to number[][] for drawKeypoints
            const landmarksAsNumbers = results.landmarks.map(
              (hand) => hand.map((point) => [point.x, point.y])
            );
            drawKeypoints(landmarksAsNumbers);
          }
        }, 100); // every 100ms
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
        <div style={{ margin: '20px 0', position: 'relative', width: 500, height: 375 }}>
          <video
            ref={videoRef}
            width={500}
            height={375}
            style={{
              border: '1px solid #ccc',
              background: '#000',
              display: recording ? 'block' : 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
            }}
            autoPlay
            muted
          />
          <canvas
            ref={overlayCanvasRef}
            width={500}
            height={375}
            style={{
              display: recording ? 'block' : 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 2,
              pointerEvents: 'none',
            }}
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
      </main>
    );
  }
  