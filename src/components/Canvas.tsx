import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Eraser, Trash2 } from 'lucide-react';

interface CanvasProps {
  socket: Socket | null;
  roomId: string;
  isDrawer: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({ socket, roomId, isDrawer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localLastPointRef = useRef({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushRadius, setBrushRadius] = useState(5);

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#8B4513', '#808080'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution to match display size for crisp lines
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Default background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!socket) return;

    const drawLine = (x0: number, y0: number, x1: number, y1: number, c: string, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = c;
      ctx.lineWidth = r * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.closePath();
    };

    let lastPoint = { x: 0, y: 0 };

    socket.on('canvas_history', (history: any[]) => {
      history.forEach((action) => {
        if (action.type === 'draw_start') {
          lastPoint = action.point;
        } else if (action.type === 'draw_move') {
          drawLine(lastPoint.x, lastPoint.y, action.point.x, action.point.y, action.color || '#000', action.brushRadius || 5);
          lastPoint = action.point;
        }
      });
    });

    socket.on('draw_start', (data) => {
      lastPoint = data.point;
    });

    socket.on('draw_move', (data) => {
      drawLine(lastPoint.x, lastPoint.y, data.point.x, data.point.y, data.color || '#000', data.brushRadius || 5);
      lastPoint = data.point;
    });

    socket.on('clear_canvas', () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off('canvas_history');
      socket.off('draw_start');
      socket.off('draw_move');
      socket.off('clear_canvas');
    };
  }, [socket]);

  // Handle Drawing Input
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawLineLocal = (x0: number, y0: number, x1: number, y1: number, c: string, r: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = c;
    ctx.lineWidth = r * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    setIsDrawing(true);
    const point = getMousePos(e);
    localLastPointRef.current = point;
    if (socket) {
      socket.emit('draw_start', { roomId, point, color, brushRadius });
    }
    
    // Draw dot for single click
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    e.preventDefault();
    const point = getMousePos(e);
    
    // Optimistic UI update using continuous lines
    drawLineLocal(localLastPointRef.current.x, localLastPointRef.current.y, point.x, point.y, color, brushRadius);
    localLastPointRef.current = point;

    if (socket) {
      socket.emit('draw_move', { roomId, point, color, brushRadius });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!isDrawer || !socket) return;
    socket.emit('clear_canvas', roomId);
    // Optimistic clear
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-xl shadow-md overflow-hidden border-4 border-indigo-100">
      {/* Canvas Area */}
      <div className="flex-grow relative bg-white cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!isDrawer && (
          <div className="absolute inset-0 z-10 bg-transparent" /> // Overlay to prevent drawing
        )}
      </div>

      {/* Toolbar - Only visible for drawer */}
      {isDrawer && (
        <div className="h-16 bg-gray-50 border-t border-gray-200 flex items-center px-4 gap-4 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1">
            {colors.map(c => (
              <button
                key={c}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-indigo-600 scale-110' : 'border-gray-200'}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          
          <div className="w-px h-8 bg-gray-300 mx-2" />
          
          <div className="flex items-center gap-3">
            <input 
              type="range" 
              min="2" 
              max="20" 
              value={brushRadius}
              onChange={(e) => setBrushRadius(parseInt(e.target.value))}
              className="w-24 accent-indigo-600"
            />
            <button 
              onClick={() => setColor('#FFFFFF')}
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${color === '#FFFFFF' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-200 text-gray-700'}`}
              title="Eraser"
            >
              <Eraser size={20} />
            </button>
            <button 
              onClick={clearCanvas}
              className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors flex items-center justify-center"
              title="Clear Canvas"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
