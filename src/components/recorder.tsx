'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

declare global {
  interface Window {
    electronAPI: {
      sendGestureAction: (action: { type: string; x?: number; y?: number; key?: string; direction?: string }) => void;
    };
  }
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // Thumb
  [0,5],[5,6],[6,7],[7,8],      // Index
  [5,9],[9,10],[10,11],[11,12], // Middle
  [9,13],[13,14],[14,15],[15,16], // Ring
  [13,17],[17,18],[18,19],[19,20], // Pinky
  [0,17] // Palm base to pinky base
];

// Helper to calculate distance between two 2D points
const calculateDistance = (p1: number[], p2: number[]): number => {
  if (!p1 || !p2) return Infinity;
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
};

// Detects a fist with index and middle fingers pointing up or down
const isFistWithFingersScroll = (hand: number[][]): 'up' | 'down' | null => {
  if (hand.length < 21) return null; // Ensure all landmarks are present

  const wrist = hand[0];
  const indexTip = hand[8];
  const indexMcp = hand[5]; // Index finger MCP joint
  const middleTip = hand[12];
  const middleMcp = hand[9]; // Middle finger MCP joint
  const ringTip = hand[16];
  const ringMcp = hand[13];
  const pinkyTip = hand[20];
  const pinkyMcp = hand[17];

  // Thresholds (these may need fine-tuning)
  const fingerFoldedToMcpThreshold = 0.09; // Max distance from tip to its MCP for a folded finger
  const fingerFoldedToWristThreshold = 0.16; // Max distance from tip to wrist for a folded finger
  const fingerExtendedMinYDiff = 0.08;   // Min Y-distance from tip to MCP for extended fingers to indicate direction
  const fingerParallelMaxYDiff = 0.07;  // Max Y-difference between index and middle tip for them to be "parallel"
  const tipMinMcDistance = 0.1; // Min distance for index/middle tips from their MCPs to be considered extended

  // 1. Check if ring and pinky fingers are folded
  const isRingFolded = calculateDistance(ringTip, ringMcp) < fingerFoldedToMcpThreshold || calculateDistance(ringTip, wrist) < fingerFoldedToWristThreshold;
  const isPinkyFolded = calculateDistance(pinkyTip, pinkyMcp) < fingerFoldedToMcpThreshold || calculateDistance(pinkyTip, wrist) < fingerFoldedToWristThreshold;
  
  if (!isRingFolded || !isPinkyFolded) {
    return null;
  }

  // 2. Check if index and middle fingers are extended
  const isIndexExtended = calculateDistance(indexTip, indexMcp) > tipMinMcDistance;
  const isMiddleExtended = calculateDistance(middleTip, middleMcp) > tipMinMcDistance;

  if (!isIndexExtended || !isMiddleExtended) {
    return null;
  }

  // 3. Determine direction based on Y-coordinates of index and middle finger tips
  const indexTipY = indexTip[1];
  const middleTipY = middleTip[1];
  const indexMcpY = indexMcp[1];
  const middleMcpY = middleMcp[1];

  // Ensure index and middle fingers are somewhat vertically aligned (tips y-coords are close)
  if (Math.abs(indexTipY - middleTipY) > fingerParallelMaxYDiff) {
    return null;
  }

  // Check for UP scroll (finger tips are above their MCPs)
  if (indexTipY < indexMcpY - fingerExtendedMinYDiff && middleTipY < middleMcpY - fingerExtendedMinYDiff) {
    return 'up';
  }

  // Check for DOWN scroll (finger tips are below their MCPs)
  if (indexTipY > indexMcpY + fingerExtendedMinYDiff && middleTipY > middleMcpY + fingerExtendedMinYDiff) {
    return 'down';
  }

  return null;
};

export default function Recorder() {
    const [recording, setRecording] = useState(false);
    const [videoURL, setVideoURL] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoChunks = useRef<Blob[]>([]);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const [isHolding, setIsHolding] = useState(false);
    const [minX, setMinX] = useState(1);
    const [maxX, setMaxX] = useState(0);
    const [minY, setMinY] = useState(1);
    const [maxY, setMaxY] = useState(0);
    const prevPosition = useRef<{ x: number; y: number } | null>(null);
    const prevVelocity = useRef<{ dx: number; dy: number } | null>(null);
  
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
          numHands: 1,
          runningMode: "VIDEO",
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
      };
      loadModel();
    }, []);
  
    const sendHandPosition = (x: number, y: number) => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use very aggressive smoothing
        const alpha = 0.08; // Even more smoothing
        const screenX = Math.round((1 - x) * window.screen.width);
        const screenY = Math.round(y * window.screen.height);
        
        // Store previous position in ref
        if (!prevPosition.current) {
          prevPosition.current = { x: screenX, y: screenY };
          return; // Skip first frame
        }
        
        // Calculate velocity-based smoothing
        const dx = screenX - prevPosition.current.x;
        const dy = screenY - prevPosition.current.y;
        
        // Apply double smoothing
        const velocitySmoothing = 0.2;
        if (!prevVelocity.current) {
          prevVelocity.current = { dx: 0, dy: 0 };
        }
        
        // Smooth the velocity first
        const smoothDx = prevVelocity.current.dx + (dx - prevVelocity.current.dx) * velocitySmoothing;
        const smoothDy = prevVelocity.current.dy + (dy - prevVelocity.current.dy) * velocitySmoothing;
        
        // Then smooth the position
        const smoothX = Math.round(prevPosition.current.x + smoothDx * alpha);
        const smoothY = Math.round(prevPosition.current.y + smoothDy * alpha);
        
        // Minimum movement threshold
        const minMovement = 3; // Increased threshold
        if (Math.abs(smoothX - prevPosition.current.x) > minMovement || 
            Math.abs(smoothY - prevPosition.current.y) > minMovement) {
          window.electronAPI.sendGestureAction({ type: 'mouse_move', x: smoothX, y: smoothY });
        }
        
        // Update previous states
        prevPosition.current = { x: smoothX, y: smoothY };
        prevVelocity.current = { dx: smoothDx, dy: smoothDy };
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

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      landmarks.forEach((hand: number[][]) => {
        drawConnectors(ctx, hand, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
        drawLandmarks(ctx, hand, { color: "#FF0000", lineWidth: 4 });
      
        if (hand[0]) {
          setMinX(prev => Math.min(prev, hand[0][0]));
          setMaxX(prev => Math.max(prev, hand[0][0]));
          setMinY(prev => Math.min(prev, hand[0][1]));
          setMaxY(prev => Math.max(prev, hand[0][1]));
      
          const normX = (hand[0][0] - minX) / (maxX - minX || 1);
          const normY = (hand[0][1] - minY) / (maxY - minY || 1);
      
          sendHandPosition(normX, normY);
        }
      
        if (isPinching(hand)) {
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendGestureAction({ type: 'mouse_click' });
          }
        }
        const pinching = isIndexMiddlePinching(hand);
        if (pinching && !isHolding) {
          setIsHolding(true);
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendGestureAction({ type: 'mouse_down' });
          }
        } else if (!pinching && isHolding) {
          setIsHolding(false);
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendGestureAction({ type: 'mouse_up' });
          }
        }
        const lGesture = isLGesture(hand);
        if (lGesture) {
          const action = { type: 'key_press', key: 'enter' };
          window.electronAPI.sendGestureAction(action);
        }

        const middleFingerGesture = isMiddleFingerGesture(hand);
        if (middleFingerGesture) {
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendGestureAction({ type: 'key_press', key: 'delete' });
          }
        }
      });
      ctx.restore();
    };
  
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
          if (
            !handLandmarkerRef.current ||
            video.readyState < 2 || 
            video.videoWidth === 0 ||
            video.videoHeight === 0
          ) {
            stopContinuousScroll();
            return;
          }
          const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());
          
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarksAsNumbers = results.landmarks.map(
              (hand) => hand.map((point) => [point.x, point.y])
            );
            drawKeypoints(landmarksAsNumbers); // For drawing and other non-continuous gestures

            // Continuous Scroll Logic
            const hand = landmarksAsNumbers[0]; // Assuming one hand for this gesture
            const detectedScrollDir = isFistWithFingersScroll(hand);

            if (detectedScrollDir) {
              if (currentScrollDirection !== detectedScrollDir) {
                stopContinuousScroll(); // Stop previous scroll if direction changes or starts new
                currentScrollDirection = detectedScrollDir;
                continuousScrollIntervalId = setInterval(() => {
                  if (typeof window !== 'undefined' && window.electronAPI) {
                    window.electronAPI.sendGestureAction({ type: 'scroll', direction: currentScrollDirection! });
                  }
                }, 150); // Adjust interval (ms) for scroll speed/responsiveness
              }
            } else { // No continuous scroll gesture detected
              if (currentScrollDirection) { // If it was scrolling, stop it
                stopContinuousScroll();
              }
            }
          } else { // No hand landmarks detected
            drawKeypoints([]); // Clear canvas if needed
            if (currentScrollDirection) { // If it was scrolling, stop it
              stopContinuousScroll();
            }
          }
        }, 33); // Hand detection runs at ~30fps (adjust from 16ms if too CPU intensive)
      }
      return () => {
        clearInterval(handDetectionIntervalId);
        stopContinuousScroll(); // Cleanup on effect unmount or when `recording` changes
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording]); // Removed drawKeypoints from dependencies as it's stable
  
    // Clean up on unmount
    useEffect(() => {
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    }, []);

    const isPinching = (hand: number[][]): boolean => {
      if (!hand[4] || !hand[8]) return false; // 4: thumb tip, 8: index tip
      const dx = hand[4][0] - hand[8][0];
      const dy = hand[4][1] - hand[8][1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 0.05; // Adjust threshold as needed
    };

    const isIndexMiddlePinching = (hand: number[][]): boolean => {
      if (!hand[8] || !hand[12]) return false; // 8: index tip, 12: middle tip
      const dx = hand[8][0] - hand[12][0];
      const dy = hand[8][1] - hand[12][1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 0.05; // Adjust threshold as needed
    };

    const isLGesture = (hand: number[][]): boolean => {
      if (!hand[0] || !hand[4] || !hand[8]) return false;
      const wrist = hand[0];
      // Thumb and index are extended (far from wrist)
      const thumbDist = Math.hypot(hand[4][0] - wrist[0], hand[4][1] - wrist[1]);
      const indexDist = Math.hypot(hand[8][0] - wrist[0], hand[8][1] - wrist[1]);
      // Other fingers are folded (close to wrist)
      const folded = [12, 16, 20].every(i => {
        if (!hand[i]) return false;
        const dist = Math.hypot(hand[i][0] - wrist[0], hand[i][1] - wrist[1]);
        return dist < 0.15; // Adjust threshold as needed
      });
      return thumbDist > 0.18 && indexDist > 0.18 && folded;
    };

    const isMiddleFingerGesture = (hand: number[][]): boolean => {
      if (!hand[0] || !hand[12]) return false;
      const wrist = hand[0];
      
      // Middle finger is extended (far from wrist)
      const middleDist = Math.hypot(hand[12][0] - wrist[0], hand[12][1] - wrist[1]);
      
      // Other fingers are folded (close to wrist)
      const fingerDistances = [4, 8, 16, 20].map(i => {
        if (!hand[i]) return null;
        return Math.hypot(hand[i][0] - wrist[0], hand[i][1] - wrist[1]);
      });
      
      // Adjust thresholds based on observed values
      const folded = fingerDistances.every(dist => dist !== null && dist < 0.25); // Increased from 0.15
      
      // Debug logging
      console.log('Middle finger distance:', middleDist);
      console.log('Other finger distances:', fingerDistances);
      console.log('All fingers folded:', folded);
      
      // Increased threshold for middle finger extension from 0.18 to 0.35
      const isGesture = middleDist > 0.35 && folded;
      if (isGesture) {
        console.log('Middle finger gesture conditions met!');
      }
      
      return isGesture;
    };

    function drawConnectors(ctx: CanvasRenderingContext2D, landmarks: number[][], connections: number[][], style: {color: string, lineWidth: number}) {
      const { color, lineWidth } = style;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      connections.forEach(([start, end]) => {
        const s = landmarks[start];
        const e = landmarks[end];
        if (s && e) {
          ctx.beginPath();
          ctx.moveTo(s[0] * ctx.canvas.width, s[1] * ctx.canvas.height);
          ctx.lineTo(e[0] * ctx.canvas.width, e[1] * ctx.canvas.height);
          ctx.stroke();
        }
      });
    }

    function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: number[][], style: {color: string, lineWidth: number}) {
      const { color, lineWidth } = style;
      ctx.fillStyle = color;
      landmarks.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point[0] * ctx.canvas.width, point[1] * ctx.canvas.height, lineWidth, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  
    return (
      <main style={{ padding: 32, minHeight: '100vh', position: 'relative' }}>
        <div className='flex justify-center items-center '>
        <div style={{ margin: '20px 0', position: 'relative', width: 800, height: 450 }}>
          <video
            ref={videoRef}
            width={800}
            height={450}
            style={{
              width: 800,
              height: 450,
              border: '1px solid #ccc',
              background: '#000',
              display: recording ? 'block' : 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              transform: 'scaleX(-1)',
            }}
            autoPlay
            muted
          />
          <canvas
            ref={overlayCanvasRef}
            width={800}
            height={450}
            style={{
              width: 800,
              height: 450,
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
  