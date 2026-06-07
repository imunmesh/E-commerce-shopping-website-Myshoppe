import React, { useState } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

const ChatInput = ({ onSendMessage, disabled }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  React.useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = 'en-US';
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setText((prev) => (prev ? prev + ' ' : '') + transcript);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      if (disabled) return;
      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled || isListening) return;
    onSendMessage(text.trim());
    setText('');
  };

  return (
    <div className="border-t border-gray-100 p-3 bg-white">

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isListening ? "Listening... Speak now." : "Ask MyShopee Assistant..."}
          disabled={disabled}
          className={`flex-1 bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-lg px-4.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amazon-yellow focus:bg-white transition duration-150 disabled:opacity-50 ${
            isListening ? 'ring-1 ring-red-500 bg-red-50/10 placeholder-red-500' : ''
          }`}
        />
        {/* Voice Dictation Button */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          className={`p-2.5 rounded-lg shadow-sm active:scale-95 transition flex items-center justify-center shrink-0 border ${
            isListening 
              ? 'bg-red-600 text-white border-red-600 animate-pulse' 
              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700'
          }`}
          title={isListening ? "Stop listening" : "Talk to agent"}
        >
          {isListening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          type="submit"
          disabled={!text.trim() || disabled || isListening}
          className="bg-amazon-orange text-white p-2.5 rounded-lg shadow-sm hover:bg-opacity-95 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition flex items-center justify-center shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
