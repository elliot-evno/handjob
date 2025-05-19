// Hand landmark connections for visualization
export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // Thumb
  [0,5],[5,6],[6,7],[7,8],      // Index
  [5,9],[9,10],[10,11],[11,12], // Middle
  [9,13],[13,14],[14,15],[15,16], // Ring
  [13,17],[17,18],[18,19],[19,20], // Pinky
  [0,17] // Palm base to pinky base
];

// Gesture detection thresholds
export const GESTURE_THRESHOLDS = {
  FINGER_FOLDED_TO_MCP: 0.09,      // Max distance from tip to its MCP for a folded finger
  FINGER_FOLDED_TO_WRIST: 0.16,    // Max distance from tip to wrist for a folded finger
  FINGER_EXTENDED_MIN_Y_DIFF: 0.08, // Min Y-distance from tip to MCP for extended fingers
  FINGER_PARALLEL_MAX_Y_DIFF: 0.07, // Max Y-difference between index and middle tip
  TIP_MIN_MC_DISTANCE: 0.1,        // Min distance for tips from MCPs to be considered extended
  PINCH_THRESHOLD: 0.05,           // Maximum distance for pinch detection
  FINGER_EXTENSION_THRESHOLD: 0.18, // Minimum distance for finger extension
  FINGER_FOLDED_THRESHOLD: 0.15,   // Maximum distance for folded fingers
  MIDDLE_FINGER_EXTENSION: 0.35,    // Threshold for middle finger extension
  OTHER_FINGERS_FOLDED: 0.25       // Threshold for other fingers being folded
}; 