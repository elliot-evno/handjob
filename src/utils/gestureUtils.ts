import { HandLandmarks, ScrollDirection } from '../types/hand';
import { GESTURE_THRESHOLDS } from '../constants/hand';

// Helper to calculate distance between two 2D points
export const calculateDistance = (p1: number[], p2: number[]): number => {
  if (!p1 || !p2) return Infinity;
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
};

// Detects a fist with index and middle fingers pointing up or down
export const detectScrollGesture = (hand: HandLandmarks): ScrollDirection => {
  if (hand.length < 21) return null;

  const {
    FINGER_FOLDED_TO_MCP,
    FINGER_FOLDED_TO_WRIST,
    FINGER_EXTENDED_MIN_Y_DIFF,
    FINGER_PARALLEL_MAX_Y_DIFF,
    TIP_MIN_MC_DISTANCE
  } = GESTURE_THRESHOLDS;

  const wrist = hand[0];
  const indexTip = hand[8];
  const indexMcp = hand[5];
  const middleTip = hand[12];
  const middleMcp = hand[9];
  const ringTip = hand[16];
  const ringMcp = hand[13];
  const pinkyTip = hand[20];
  const pinkyMcp = hand[17];

  // Check if ring and pinky fingers are folded
  const isRingFolded = calculateDistance(ringTip, ringMcp) < FINGER_FOLDED_TO_MCP || 
                       calculateDistance(ringTip, wrist) < FINGER_FOLDED_TO_WRIST;
  const isPinkyFolded = calculateDistance(pinkyTip, pinkyMcp) < FINGER_FOLDED_TO_MCP || 
                        calculateDistance(pinkyTip, wrist) < FINGER_FOLDED_TO_WRIST;
  
  if (!isRingFolded || !isPinkyFolded) return null;

  // Check if index and middle fingers are extended
  const isIndexExtended = calculateDistance(indexTip, indexMcp) > TIP_MIN_MC_DISTANCE;
  const isMiddleExtended = calculateDistance(middleTip, middleMcp) > TIP_MIN_MC_DISTANCE;

  if (!isIndexExtended || !isMiddleExtended) return null;

  const indexTipY = indexTip[1];
  const middleTipY = middleTip[1];
  const indexMcpY = indexMcp[1];
  const middleMcpY = middleMcp[1];

  // Ensure index and middle fingers are somewhat vertically aligned
  if (Math.abs(indexTipY - middleTipY) > FINGER_PARALLEL_MAX_Y_DIFF) return null;

  // Check for UP scroll
  if (indexTipY < indexMcpY - FINGER_EXTENDED_MIN_Y_DIFF && 
      middleTipY < middleMcpY - FINGER_EXTENDED_MIN_Y_DIFF) {
    return 'up';
  }

  // Check for DOWN scroll
  if (indexTipY > indexMcpY + FINGER_EXTENDED_MIN_Y_DIFF && 
      middleTipY > middleMcpY + FINGER_EXTENDED_MIN_Y_DIFF) {
    return 'down';
  }

  return null;
};

export const isPinching = (hand: HandLandmarks): boolean => {
  if (!hand[4] || !hand[8]) return false;
  return calculateDistance(hand[4], hand[8]) < GESTURE_THRESHOLDS.PINCH_THRESHOLD;
};

export const isIndexMiddlePinching = (hand: HandLandmarks): boolean => {
  if (!hand[8] || !hand[12]) return false;
  return calculateDistance(hand[8], hand[12]) < GESTURE_THRESHOLDS.PINCH_THRESHOLD;
};

export const isLGesture = (hand: HandLandmarks): boolean => {
  if (!hand[0] || !hand[4] || !hand[8]) return false;
  const wrist = hand[0];
  
  const thumbDist = Math.hypot(hand[4][0] - wrist[0], hand[4][1] - wrist[1]);
  const indexDist = Math.hypot(hand[8][0] - wrist[0], hand[8][1] - wrist[1]);
  
  const folded = [12, 16, 20].every(i => {
    if (!hand[i]) return false;
    const dist = Math.hypot(hand[i][0] - wrist[0], hand[i][1] - wrist[1]);
    return dist < GESTURE_THRESHOLDS.FINGER_FOLDED_THRESHOLD;
  });

  return thumbDist > GESTURE_THRESHOLDS.FINGER_EXTENSION_THRESHOLD && 
         indexDist > GESTURE_THRESHOLDS.FINGER_EXTENSION_THRESHOLD && 
         folded;
};

export const isMiddleFingerGesture = (hand: HandLandmarks): boolean => {
  if (!hand[0] || !hand[12]) return false;
  const wrist = hand[0];
  
  const middleDist = Math.hypot(hand[12][0] - wrist[0], hand[12][1] - wrist[1]);
  
  const fingerDistances = [4, 8, 16, 20].map(i => {
    if (!hand[i]) return null;
    return Math.hypot(hand[i][0] - wrist[0], hand[i][1] - wrist[1]);
  });
  
  const folded = fingerDistances.every(dist => 
    dist !== null && dist < GESTURE_THRESHOLDS.OTHER_FINGERS_FOLDED
  );
  
  return middleDist > GESTURE_THRESHOLDS.MIDDLE_FINGER_EXTENSION && folded;
}; 