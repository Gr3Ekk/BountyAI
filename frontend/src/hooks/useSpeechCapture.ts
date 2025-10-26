import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type SpeechRecognitionAlternative = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type UseSpeechCaptureOptions = {
  language?: string;
  interimResults?: boolean;
  continuous?: boolean;
  onResult?: (segment: { transcript: string; isFinal: boolean }) => void;
  onError?: (message: string) => void;
};

type UseSpeechCaptureReturn = {
  isSupported: boolean;
  isRecording: boolean;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

function resolveConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const scopedWindow = window as Window & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  const Constructor = scopedWindow.SpeechRecognition ?? scopedWindow.webkitSpeechRecognition ?? null;
  return Constructor;
}

export function useSpeechCapture(options: UseSpeechCaptureOptions = {}): UseSpeechCaptureReturn {
  const recognitionConstructor = useMemo(() => resolveConstructor(), []);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionConstructor) {
      setError('Voice capture is not supported in this browser.');
      options.onError?.('Voice capture is not supported in this browser.');
      return;
    }

    if (isRecording) {
      return;
    }

    try {
      const recognition = new recognitionConstructor();
      recognition.lang = options.language ?? 'en-US';
      recognition.interimResults = options.interimResults ?? true;
      recognition.continuous = options.continuous ?? false;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const results = event.results;
        if (!results || results.length === 0) {
          return;
        }
        const result = results[event.resultIndex];
        const transcript = result?.[0]?.transcript ?? '';
        const isFinal = Boolean(result?.isFinal);
        if (isFinal) {
          setInterimTranscript('');
        } else {
          setInterimTranscript(transcript);
        }
        options.onResult?.({ transcript, isFinal });
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const message = event.error ?? 'Speech recognition error';
        setError(message);
        options.onError?.(message);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setError(null);
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Failed to start voice capture';
      setError(message);
      options.onError?.(message);
    }
  }, [recognitionConstructor, isRecording, options]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isSupported: Boolean(recognitionConstructor),
    isRecording,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
