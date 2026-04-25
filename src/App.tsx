import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameView } from './components/GameView';
import { Palette } from 'lucide-react';

const SERVER_URL = 'https://scribble-io-new.onrender.com';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('room_error', (msg) => {
      setError(msg);
      setInRoom(false);
    });

    return () => {
      newSocket.off('room_error');
      newSocket.close();
    };
  }, []);

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !name.trim()) {
      setError('Please enter both name and room code');
      return;
    }
    
    if (socket) {
      socket.emit('join_room', { roomId, name, isPractice: false });
      setInRoom(true);
    }
  };

  const createRoom = () => {
    if (!name.trim()) {
      setError('Please enter your name first');
      return;
    }
    const generatedId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(generatedId);
    if (socket) {
      socket.emit('join_room', { roomId: generatedId, name, isPractice: false });
      setInRoom(true);
    }
  };

  const startPractice = () => {
    if (!name.trim()) {
      setError('Please enter your name first');
      return;
    }
    const practiceId = `PRACTICE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setRoomId(practiceId);
    if (socket) {
      socket.emit('join_room', { roomId: practiceId, name, isPractice: true });
      setInRoom(true);
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave_room', roomId);
    }
    setInRoom(false);
    setRoomId('');
  };

  if (inRoom && socket) {
    return <GameView socket={socket} roomId={roomId} currentPlayerId={socket.id || ''} onLeave={handleLeave} />;
  }

  return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border-4 border-indigo-100 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Palette size={40} className="text-indigo-600" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-wider">SKRIBBL.IO</h1>
          <p className="text-indigo-200 mt-2 font-medium">Multiplayer Drawing Game</p>
        </div>
        
        <form onSubmit={joinRoom} className="p-8 space-y-6">
          {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm font-bold text-center">{error}</div>}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                maxLength={15}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your nickname"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-600 focus:ring-0 outline-none transition-colors text-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Room Code (To Join)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={roomId}
                  onChange={e => setRoomId(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDEF"
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-600 focus:ring-0 outline-none transition-colors text-lg font-mono uppercase"
                />
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 shrink-0"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3 flex-col sm:flex-row">
            <button
              type="button"
              onClick={createRoom}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={startPractice}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95"
            >
              Practice Mode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
