import { HandLandmarks, DrawingStyle } from '../types/hand';

export function drawConnectors(
  ctx: CanvasRenderingContext2D, 
  landmarks: HandLandmarks, 
  connections: number[][], 
  style: DrawingStyle
) {
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

export function drawLandmarks(
  ctx: CanvasRenderingContext2D, 
  landmarks: HandLandmarks, 
  style: DrawingStyle
) {
  const { color, lineWidth } = style;
  ctx.fillStyle = color;
  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point[0] * ctx.canvas.width, point[1] * ctx.canvas.height, lineWidth, 0, 2 * Math.PI);
    ctx.fill();
  });
} 

