// Types for hand detection and gestures
export type Point2D = [number, number];
export type HandLandmarks = Point2D[];
export type DrawingStyle = {
  color: string;
  lineWidth: number;
};

export type ScrollDirection = 'up' | 'down' | null;

// Window API extension
declare global {
  interface Window {
    electronAPI: {
      sendGestureAction: (action: GestureAction) => void;
      showRecordingDialog: () => Promise<boolean>;
    };
  }
}

export type GestureAction = {
  type: 'mouse_move' | 'mouse_click' | 'mouse_down' | 'mouse_up' | 'key_press' | 'scroll';
  x?: number;
  y?: number;
  key?: string;
  direction?: string;
}; 