import React, { useEffect, useState, useRef } from 'react';
import { Language } from '../types';

interface VoiceControlsProps {
  language: Language;
  onTranscriptChange: (text: string) => void;
  onListeningEnd: () => void;
  isListening: boolean;
  setIsListening: (val: boolean) => void;
  hintText: string;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  language,
  onTranscriptChange,
  onListeningEnd,
  isListening,
  setIsListening,
  hintText
}) => {
  const recognitionRef = useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      
      // CRITICAL: Continuous must be true to allow long lists
      recog.continuous = true;
      // CRITICAL: Interim results true to see text AS you speak
      recog.interimResults = true;
      
      recog.onresult = (event: any) => {
        // Reconstruct the full transcript from the session history
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          finalTranscript += event.results[i][0].transcript;
        }
        setLiveTranscript(finalTranscript);
        onTranscriptChange(finalTranscript);
      };

      recog.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone permission denied.");
          setIsListening(false);
        }
      };

      recog.onend = () => {
        // Only trigger end logic if we were actually listening (avoids duplicate calls)
        setIsListening(false);
        setLiveTranscript('');
        onListeningEnd();
      };

      recognitionRef.current = recog;
    }
  }, [onTranscriptChange, onListeningEnd, setIsListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Browser does not support Voice Recognition.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setLiveTranscript('');
      recognitionRef.current.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start", e);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <button
        onClick={toggleListening}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-300 shadow-lg ${
          isListening
            ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200'
            : 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white hover:from-cyan-600 hover:to-cyan-500 ring-4 ring-cyan-100'
        }`}
      >
        <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
      </button>
      
      <p className={`mt-3 text-sm font-medium ${isListening ? 'text-red-500' : 'text-gray-500'}`}>
        {isListening ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            {language === 'ta' ? 'கேட்கிறது...' : 'Listening...'}
          </span>
        ) : (
          hintText
        )}
      </p>
      
      {/* Live Transcript Display */}
      {isListening && liveTranscript && (
        <div className="mt-3 px-4 py-2 bg-cyan-50 border border-cyan-200 rounded-lg max-w-md mx-4">
          <p className="text-xs text-cyan-600 font-medium mb-1">
            {language === 'ta' ? '🎤 கேட்ட உரை:' : '🎤 Heard:'}
          </p>
          <p className="text-sm text-cyan-800 font-medium break-words leading-relaxed">
            {liveTranscript}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;