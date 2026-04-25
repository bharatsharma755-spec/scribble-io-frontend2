import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Canvas } from './Canvas';
import { Users, Clock, Send, Trophy, Info, Copy, Check, LogOut } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  score: number;
  hasGuessedCorrectly: boolean;
}

interface ChatMessage {
  sender: string;
  text: string;
  isSystem: boolean;
  isCorrectGuess?: boolean;
  guesserId?: string;
}

interface GameViewProps {
  socket: Socket | null;
  roomId: string;
  currentPlayerId: string;
  onLeave: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ socket, roomId, currentPlayerId, onLeave }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, PLAYING, ROUND_OVER, GAME_OVER
  const [drawerId, setDrawerId] = useState('');
  const [timer, setTimer] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [wordLength, setWordLength] = useState(0);
  const [hint, setHint] = useState('');
  const [round, setRound] = useState(0);
  const [gameOverStats, setGameOverStats] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDrawer = currentPlayerId === drawerId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    socket.on('room_update', (data) => {
      setPlayers(data.players);
      setGameState(data.gameState);
      if (data.drawerId) setDrawerId(data.drawerId);
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('round_start', (data) => {
      setGameState('PLAYING');
      setRound(data.round);
      setDrawerId(data.drawerId);
      setWordLength(data.wordLength);
      setHint(data.hint || '');
      setCurrentWord(''); // Clear word for guessers
    });

    socket.on('hint_update', (newHint) => {
      setHint(newHint);
    });

    socket.on('your_word', (word) => {
      setCurrentWord(word);
    });

    socket.on('timer_tick', (time) => {
      setTimer(time);
    });

    socket.on('round_over', (data) => {
      setGameState('ROUND_OVER');
      setCurrentWord(data.word); // Reveal word to everyone
      setPlayers(data.players);
      setMessages(prev => [...prev, {
        sender: 'System',
        text: `Round Over! The word was "${data.word}". ${data.reason}`,
        isSystem: true
      }]);
    });

    socket.on('game_over', (data) => {
      setGameState('GAME_OVER');
      setGameOverStats(data.players.sort((a: Player, b: Player) => b.score - a.score));
    });

    socket.on('game_stopped', (msg) => {
      setGameState('LOBBY');
      alert(msg);
    });

    return () => {
      socket.off('room_update');
      socket.off('chat_message');
      socket.off('round_start');
      socket.off('hint_update');
      socket.off('your_word');
      socket.off('timer_tick');
      socket.off('round_over');
      socket.off('game_over');
      socket.off('game_stopped');
    };
  }, [socket]);

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    
    // Prevent drawer from giving away the answer via chat if we want,
    // but typically Skribbl allows them to chat normally.
    socket.emit('chat_message', { roomId, text: chatInput });
    setChatInput('');
  };

  const startGame = () => {
    if (socket) socket.emit('start_game', roomId);
  };

  const renderWordHint = () => {
    if (gameState !== 'PLAYING') return currentWord;
    if (isDrawer) return currentWord;
    
    // Guessers see the dynamic hint
    return hint ? hint.split('').join(' ') : Array(wordLength).fill('_').join(' ');
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-indigo-50 font-sans p-4 flex flex-col items-center">
      
      {/* Header Container */}
      <div className="w-full max-w-6xl flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 mb-4 border-2 border-indigo-100">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xl shadow-inner">
            Round {round || 1}
          </div>
          {gameState === 'PLAYING' && (
            <div className="flex items-center gap-2 text-xl font-bold text-gray-700 bg-gray-100 px-4 py-2 rounded-xl">
              <Clock className={timer <= 10 ? "text-red-500 animate-pulse" : "text-gray-500"} />
              <span className={timer <= 10 ? "text-red-500" : ""}>{timer}s</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 flex justify-center">
          {gameState === 'PLAYING' ? (
             <div className="text-3xl font-mono font-bold tracking-widest text-indigo-900 bg-indigo-50 px-8 py-3 rounded-2xl border border-indigo-100 shadow-inner">
               {renderWordHint()}
             </div>
          ) : gameState === 'ROUND_OVER' ? (
             <div className="text-2xl font-bold text-green-600 bg-green-50 px-8 py-3 rounded-2xl border border-green-200">
               The word was: <span className="uppercase">{currentWord}</span>
             </div>
          ) : (
            <div className="text-xl font-bold text-gray-500 flex items-center gap-2">
              <Info /> Waiting to start...
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-xl font-bold border border-purple-200 flex items-center gap-2">
            <Users size={18} />
            Room: {roomId}
          </div>
          <button 
            onClick={copyRoomLink}
            className="p-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl transition-colors"
            title="Copy Room Code"
          >
            {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
          </button>
          <button 
            onClick={onLeave}
            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl transition-colors ml-2"
            title="Quit Game"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="w-full max-w-6xl flex-1 flex gap-4 min-h-[600px] h-[calc(100vh-140px)]">
        
        {/* Leaderboard Sidebar */}
        <div className="w-64 bg-white rounded-2xl shadow-md border-2 border-indigo-100 flex flex-col overflow-hidden shrink-0">
          <div className="bg-indigo-600 text-white p-3 font-bold flex items-center gap-2">
            <Trophy size={18} /> Leaderboard
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {players.sort((a, b) => b.score - a.score).map((p, idx) => (
              <div 
                key={p.id} 
                className={`p-3 rounded-xl flex items-center justify-between transition-colors ${
                  p.id === drawerId ? 'bg-yellow-100 border-2 border-yellow-400' : 
                  p.hasGuessedCorrectly ? 'bg-green-100 border-2 border-green-400' : 
                  'bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="font-bold text-gray-500 w-4">#{idx + 1}</div>
                  <div className="font-semibold text-gray-800 truncate">
                    {p.name} {p.id === currentPlayerId && '(You)'}
                  </div>
                </div>
                <div className="font-bold text-indigo-600">{p.score}</div>
              </div>
            ))}
          </div>
          
          {gameState === 'LOBBY' && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
              <div className="text-gray-600 font-bold mb-3 flex items-center justify-center gap-2">
                <Users size={16} /> Players: {players.length} / 5
              </div>
              {players[0]?.id === currentPlayerId ? (
                <button 
                  onClick={startGame}
                  disabled={players.length < 2}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
                >
                  {players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
                </button>
              ) : (
                <div className="text-sm font-semibold text-gray-500 italic p-2">Waiting for host to start...</div>
              )}
            </div>
          )}
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative">
          {gameState === 'GAME_OVER' ? (
             <div className="w-full h-full bg-white rounded-2xl shadow-md border-4 border-indigo-100 flex flex-col items-center justify-center p-8">
               <Trophy size={80} className="text-yellow-400 mb-6" />
               <h2 className="text-4xl font-bold text-indigo-900 mb-8">Final Standings</h2>
               <div className="w-full max-w-md space-y-4 mb-8">
                 {gameOverStats.slice(0, 3).map((p, idx) => (
                   <div key={p.id} className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl text-xl font-bold">
                     <span className="flex items-center gap-4">
                       <span className="text-gray-500">#{idx + 1}</span>
                       <span>{p.name}</span>
                     </span>
                     <span className="text-indigo-600">{p.score} pts</span>
                   </div>
                 ))}
               </div>
               {players[0]?.id === currentPlayerId && (
                 <button 
                   onClick={startGame}
                   className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-lg text-xl"
                 >
                   Play Again
                 </button>
               )}
             </div>
          ) : (
             <Canvas socket={socket} roomId={roomId} isDrawer={isDrawer} />
          )}

          {/* Overlays */}
          {gameState === 'PLAYING' && isDrawer && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold shadow-lg animate-bounce z-20">
              You are drawing!
            </div>
          )}
          {gameState === 'ROUND_OVER' && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
               <div className="bg-white p-8 rounded-2xl shadow-2xl text-center animate-in zoom-in">
                 <h2 className="text-3xl font-bold text-indigo-900 mb-2">Round Over</h2>
                 <p className="text-xl text-gray-600">Next round starting soon...</p>
               </div>
             </div>
          )}
        </div>

        {/* Chat Sidebar */}
        <div className="w-80 bg-white rounded-2xl shadow-md border-2 border-indigo-100 flex flex-col overflow-hidden shrink-0">
          <div className="bg-indigo-600 text-white p-3 font-bold flex items-center gap-2">
             Chat
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`break-words text-sm ${
                  msg.isSystem ? 'text-center font-bold italic' : ''
                } ${msg.isCorrectGuess ? 'text-green-600 bg-green-100 p-2 rounded-lg border border-green-200' : ''}`}
              >
                {!msg.isSystem && <span className="font-bold text-indigo-900 mr-2">{msg.sender}:</span>}
                <span className={msg.isSystem && !msg.isCorrectGuess ? "text-gray-500" : ""}>{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendChat} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={gameState !== 'PLAYING' || isDrawer || players.find(p => p.id === currentPlayerId)?.hasGuessedCorrectly}
              placeholder={isDrawer ? "You can't chat while drawing!" : "Type your guess..."}
              className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 outline-none"
            />
            <button 
              type="submit"
              disabled={gameState !== 'PLAYING' || isDrawer || !chatInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white p-2 rounded-xl transition-colors shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
