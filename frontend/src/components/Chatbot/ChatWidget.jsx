import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Minimize2, Plus, MessageCircle, Trash2, List, Volume2, VolumeX } from 'lucide-react';
import * as chatService from '../../services/chatService';
import { fetchCart } from '../../store/cartSlice';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

// Helper to generate a unique session UUID
const generateUuid = () => {
  return 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
};

// Speech synthesis helper
const speak = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    // Strip markdown formatting for natural reading
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\#/g, '')
      .replace(/\_/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  }
};

const ChatWidget = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const location = useLocation();

  // Widget visibility states
  const [isOpen, setIsOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  // Audio configuration
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    return localStorage.getItem('myshopee_chat_audio_enabled') === 'true';
  });

  // Sessions and messaging state
  const [sessions, setSessions] = useState([]);
  const [currentSessionUuid, setCurrentSessionUuid] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Load or generate initial session UUID
  useEffect(() => {
    const savedSessionUuid = localStorage.getItem('myshopee_chat_session_uuid');
    if (savedSessionUuid) {
      setCurrentSessionUuid(savedSessionUuid);
      loadSessionMessages(savedSessionUuid);
    } else {
      startNewSession();
    }
  }, []);

  // Sync sessions when authenticated user changes or panel toggles
  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    } else {
      setSessions([]);
    }
  }, [isAuthenticated, isOpen]);

  // Autoscroll message list to latest
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startNewSession = () => {
    const newUuid = generateUuid();
    setCurrentSessionUuid(newUuid);
    setMessages([]);
    localStorage.setItem('myshopee_chat_session_uuid', newUuid);
    setShowSessions(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const loadSessions = async () => {
    if (!isAuthenticated) return;
    setSessionsLoading(true);
    try {
      const data = await chatService.fetchSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSessionMessages = async (uuid) => {
    try {
      const history = await chatService.fetchMessages(uuid);
      // Historical messages should not animate typing
      const mappedHistory = history.map(msg => ({ ...msg, isNew: false }));
      setMessages(mappedHistory);
    } catch (e) {
      console.error('Failed to load messages history:', e);
    }
  };

  const handleSelectSession = (uuid) => {
    setCurrentSessionUuid(uuid);
    localStorage.setItem('myshopee_chat_session_uuid', uuid);
    loadSessionMessages(uuid);
    setShowSessions(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleDeleteSession = async (e, uuid) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      await chatService.deleteSession(uuid);
      if (currentSessionUuid === uuid) {
        startNewSession();
      }
      loadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSendMessage = async (text) => {
    // Add message locally for immediate UI update
    const tempUserMessage = { sender: 'user', message: text, created_at: new Date() };
    setMessages((prev) => [...prev, tempUserMessage]);
    
    setLoading(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop talking when user speaks/types new input
    }

    // Extract active product ID from path if viewing product page (e.g. /product/12)
    const match = location.pathname.match(/\/product\/(\d+)/);
    const contextProductId = match ? parseInt(match[1], 10) : null;

    try {
      const response = await chatService.sendMessage(currentSessionUuid, text, contextProductId);
      
      const tempBotMessage = {
        sender: 'bot',
        message: response.reply,
        metadata: response.metadata,
        created_at: new Date(),
        isNew: true // Triggers typing animation
      };
      
      setMessages((prev) => [...prev, tempBotMessage]);

      // Refresh cart if updated by database agent tool
      if (response.metadata?.cartUpdated) {
        dispatch(fetchCart());
      }

      // Read aloud if enabled
      if (isAudioEnabled) {
        speak(response.reply);
      }

      // Refresh sessions to show updated titles
      if (isAuthenticated) {
        loadSessions();
      }
    } catch (error) {
      console.error('Failed to get bot reply:', error);
      const tempErrorMessage = {
        sender: 'bot',
        message: 'Sorry, I failed to process that request. Check your internet connection and try again.',
        created_at: new Date()
      };
      setMessages((prev) => [...prev, tempErrorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAudio = () => {
    const nextVal = !isAudioEnabled;
    setIsAudioEnabled(nextVal);
    localStorage.setItem('myshopee_chat_audio_enabled', String(nextVal));
    if (!nextVal && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleMinimize = () => {
    setIsOpen(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-amazon-orange text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center border border-amazon-orange hover:bg-opacity-95"
          title="Open AI Shopping Assistant"
        >
          <MessageCircle size={28} className="animate-pulse" style={{ animationDuration: '2s' }} />
        </button>
      )}

      {/* Chat widget window */}
      {isOpen && (
        <div className="bg-white w-[350px] sm:w-[400px] h-[550px] rounded-2xl shadow-2xl border border-gray-150 flex flex-col overflow-hidden transition-all duration-300">
          
          {/* Header Panel */}
          <div className="bg-amazon-blue text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-amazon-orange/10 flex items-center justify-center border border-amazon-orange">
                <MessageSquare size={16} className="text-amazon-orange" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight">Shopping Assistant</h3>
                <span className="text-[10px] text-green-400 font-bold block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span> AI Agent Online
                </span>
              </div>
            </div>

            {/* Header controls */}
            <div className="flex items-center space-x-2">
              {/* Speaker Toggle Button */}
              <button
                onClick={toggleAudio}
                className="p-1.5 hover:bg-white/10 rounded transition text-gray-300 hover:text-white"
                title={isAudioEnabled ? "Mute audio response" : "Read responses aloud"}
              >
                {isAudioEnabled ? <Volume2 size={16} className="text-amazon-orange animate-bounce" /> : <VolumeX size={16} />}
              </button>

              {isAuthenticated && (
                <button
                  onClick={() => setShowSessions(!showSessions)}
                  className="p-1.5 hover:bg-white/10 rounded transition text-gray-300 hover:text-white"
                  title="Toggle Conversations History"
                >
                  <List size={16} />
                </button>
              )}
              <button
                onClick={handleMinimize}
                className="p-1.5 hover:bg-white/10 rounded transition text-gray-300 hover:text-white"
                title="Minimize Chat"
              >
                <Minimize2 size={16} />
              </button>
            </div>
          </div>

          {/* Session History Overlay Sidebar */}
          {showSessions && isAuthenticated && (
            <div className="flex-1 bg-gray-50 flex flex-col justify-between overflow-y-auto border-b border-gray-200">
              <div className="p-4 space-y-4 flex-1">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <h4 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Conversations</h4>
                  <button
                    onClick={startNewSession}
                    className="flex items-center space-x-1 text-[10px] font-bold bg-amazon-orange text-white px-2 py-1 rounded shadow-xs hover:bg-opacity-95 transition"
                  >
                    <Plus size={10} />
                    <span>New Chat</span>
                  </button>
                </div>

                {sessionsLoading ? (
                  <p className="text-xs text-gray-400 text-center py-6">Loading histories...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No saved chat history found.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {sessions.map((sess) => {
                      const isActive = currentSessionUuid === sess.session_uuid;
                      return (
                        <div
                          key={sess.session_uuid}
                          onClick={() => handleSelectSession(sess.session_uuid)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                            isActive
                              ? 'bg-amber-500/10 border-amazon-orange'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-bold text-xs text-gray-800 truncate flex-1 pr-2">{sess.title}</span>
                          <button
                            onClick={(e) => handleDeleteSession(e, sess.session_uuid)}
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded"
                            title="Delete Chat Log"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowSessions(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 font-bold text-xs shrink-0 text-center transition"
              >
                Return to Chat
              </button>
            </div>
          )}

          {/* Chat Pane messages list */}
          {(!showSessions || !isAuthenticated) && (
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 space-y-4">
              
              {/* Authentication Callout Banner */}
              {!isAuthenticated && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center text-xs space-y-1.5">
                  <span className="font-bold text-amber-800">💡 Login for Personalized Support</span>
                  <p className="text-gray-500 leading-normal">Sign in to save chat sessions, search recent orders, or ask about order tracking status.</p>
                </div>
              )}

              {/* Start Banner */}
              {messages.length === 0 && (
                <div className="py-8 text-center space-y-2 flex flex-col items-center">
                  <span className="text-4xl">👋</span>
                  <h4 className="font-extrabold text-sm text-gray-900">How can I help you today?</h4>
                  <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
                    Ask me about product inventory, shipping status, product comparisons, or coupons.
                  </p>
                </div>
              )}

              {/* Messages list */}
              {messages.map((msg, index) => (
                <ChatMessage key={index} msg={msg} />
              ))}

              {/* Thinking loader */}
              {loading && (
                <div className="flex flex-col space-y-1 items-start max-w-[85%]">
                  <span className="text-[9px] font-bold text-gray-400 px-1">MyShopee Agent</span>
                  <div className="bg-white border border-gray-150 rounded-2xl px-4 py-3 shadow-xs rounded-tl-none">
                    <div className="flex items-center space-x-1 py-1 px-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amazon-orange animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amazon-orange animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amazon-orange animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Panel */}
          {(!showSessions || !isAuthenticated) && (
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={loading}
            />
          )}

        </div>
      )}
    </div>
  );
};

export default ChatWidget;
