'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { HAND_CONNECTIONS } from '../constants/hand';
import { drawConnectors, drawLandmarks } from '../utils/drawingUtils';
import { 
  detectScrollGesture, 
  isPinching, 
  isIndexMiddlePinching, 
  isLGesture, 
  isMiddleFingerGesture 
} from '../utils/gestureUtils';

export default function Recorder() {
  const [recording, setRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [minX, setMinX] = useState(1);
  const [maxX, setMaxX] = useState(0);
  const [minY, setMinY] = useState(1);
  const [maxY, setMaxY] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const prevPosition = useRef<{ x: number; y: number } | null>(null);
  const prevVelocity = useRef<{ dx: number; dy: number } | null>(null);

  const sendHandPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const alpha = 0.08;
    const screenX = Math.round((1 - x) * window.screen.width);
    const screenY = Math.round(y * window.screen.height);
    
    if (!prevPosition.current) {
      prevPosition.current = { x: screenX, y: screenY };
      return;
    }
    
    const dx = screenX - prevPosition.current.x;
    const dy = screenY - prevPosition.current.y;
    
    const velocitySmoothing = 0.2;
    if (!prevVelocity.current) {
      prevVelocity.current = { dx: 0, dy: 0 };
    }
    
    const smoothDx = prevVelocity.current.dx + (dx - prevVelocity.current.dx) * velocitySmoothing;
    const smoothDy = prevVelocity.current.dy + (dy - prevVelocity.current.dy) * velocitySmoothing;
    
    const smoothX = Math.round(prevPosition.current.x + smoothDx * alpha);
    const smoothY = Math.round(prevPosition.current.y + smoothDy * alpha);
    
    const minMovement = 3;
    if (Math.abs(smoothX - prevPosition.current.x) > minMovement || 
        Math.abs(smoothY - prevPosition.current.y) > minMovement) {
      window.electronAPI.sendGestureAction({ type: 'mouse_move', x: smoothX, y: smoothY });
    }
    
    prevPosition.current = { x: smoothX, y: smoothY };
    prevVelocity.current = { dx: smoothDx, dy: smoothDy };
  }, []);

  const drawKeypoints = useCallback((landmarks: number[][][]) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    landmarks.forEach((hand) => {
      if (!Array.isArray(hand) || hand.length === 0 || !Array.isArray(hand[0]) || hand[0].length < 2) return;

      drawConnectors(ctx, hand as [number, number][], HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
      drawLandmarks(ctx, hand as [number, number][], { color: "#FF0000", lineWidth: 4 });

      if (hand[0]) {
        setMinX(prev => Math.min(prev, hand[0][0]));
        setMaxX(prev => Math.max(prev, hand[0][0]));
        setMinY(prev => Math.min(prev, hand[0][1]));
        setMaxY(prev => Math.max(prev, hand[0][1]));

        const normX = (hand[0][0] - minX) / (maxX - minX || 1);
        const normY = (hand[0][1] - minY) / (maxY - minY || 1);
        sendHandPosition(normX, normY);
      }

      if (isPinching(hand as [number, number][])) {
        window.electronAPI?.sendGestureAction({ type: 'mouse_click' });
      }

      const pinching = isIndexMiddlePinching(hand as [number, number][]);
      if (pinching && !isHolding) {
        setIsHolding(true);
        window.electronAPI?.sendGestureAction({ type: 'mouse_down' });
      } else if (!pinching && isHolding) {
        setIsHolding(false);
        window.electronAPI?.sendGestureAction({ type: 'mouse_up' });
      }

      if (isLGesture(hand as [number, number][])) {
        window.electronAPI?.sendGestureAction({ type: 'key_press', key: 'enter' });
      }

      if (isMiddleFingerGesture(hand as [number, number][])) {
        window.electronAPI?.sendGestureAction({ type: 'key_press', key: 'delete' });
      }
    });
    ctx.restore();
  }, [isHolding, maxX, maxY, minX, minY, sendHandPosition]);

  useEffect(() => {
    const loadModel = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        numHands: 1,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      // Show dialog after model is loaded
      const shouldStart = await window.electronAPI.showRecordingDialog();
      if (shouldStart) {
        startRecording();
      }
    };
    loadModel();
  }, []);

  useEffect(() => {
    let handDetectionIntervalId: NodeJS.Timeout;
    let continuousScrollIntervalId: NodeJS.Timeout | null = null;
    let currentScrollDirection: 'up' | 'down' | null = null;

    const stopContinuousScroll = () => {
      if (continuousScrollIntervalId) {
        clearInterval(continuousScrollIntervalId);
        continuousScrollIntervalId = null;
      }
      currentScrollDirection = null;
    };

    if (recording && videoRef.current && overlayCanvasRef.current && handLandmarkerRef.current) {
      handDetectionIntervalId = setInterval(async () => {
        const video = videoRef.current!;
        if (!handLandmarkerRef.current || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
          stopContinuousScroll();
          return;
        }

        const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarksAsNumbers = results.landmarks.map(
            (hand) => hand.map((point) => [point.x, point.y])
          );
          drawKeypoints(landmarksAsNumbers);

          // Handle scroll gesture
          const hand = landmarksAsNumbers[0];
          const detectedScrollDir = detectScrollGesture(hand as [number, number][]);

          if (detectedScrollDir) {
            if (currentScrollDirection !== detectedScrollDir) {
              stopContinuousScroll();
              currentScrollDirection = detectedScrollDir;
              continuousScrollIntervalId = setInterval(() => {
                window.electronAPI?.sendGestureAction({ 
                  type: 'scroll', 
                  direction: currentScrollDirection! 
                });
              }, 150);
            }
          } else if (currentScrollDirection) {
            stopContinuousScroll();
          }
        } else {
          drawKeypoints([]);
          if (currentScrollDirection) {
            stopContinuousScroll();
          }
        }
      }, 33);
    }

    return () => {
      clearInterval(handDetectionIntervalId);
      stopContinuousScroll();
    };
  }, [drawKeypoints, recording]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }

    setRecording(true);
  };

  // Return null instead of any visible elements
  return (
    <div aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        width={800}
        height={450}
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={overlayCanvasRef}
        width={800}
        height={450}
      />
    </div>
  );
}
