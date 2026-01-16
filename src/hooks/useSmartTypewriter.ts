import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSmartTypewriterOptions {
  baseSpeed?: number;  // Base typing speed in ms
  minSpeed?: number;   // Minimum speed when catching up
  maxBuffer?: number;  // Buffer size to trigger instant mode
}

export function useSmartTypewriter(options: UseSmartTypewriterOptions = {}) {
  const { baseSpeed = 30, minSpeed = 5, maxBuffer = 500 } = options;
  
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const buffer = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addChunk = useCallback((chunk: string) => {
    buffer.current += chunk;
    setIsComplete(false);
    if (!isTyping) setIsTyping(true);
  }, [isTyping]);

  const skipToEnd = useCallback(() => {
    setDisplayedText(prev => prev + buffer.current);
    buffer.current = '';
    setIsTyping(false);
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    buffer.current = '';
    setDisplayedText('');
    setIsTyping(false);
    setIsComplete(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isTyping) return;

    const runTypewriter = () => {
      if (buffer.current.length > 0) {
        const bufferLength = buffer.current.length;
        
        // Smart catch-up: speed up when buffer is large
        let charsToTake = 1;
        let dynamicSpeed = baseSpeed;
        
        if (bufferLength > maxBuffer) {
          // Instant mode: dump everything
          setDisplayedText(prev => prev + buffer.current);
          buffer.current = '';
          setIsTyping(false);
          setIsComplete(true);
          return;
        } else if (bufferLength > 200) {
          // Fast mode: 5 chars at a time
          charsToTake = 5;
          dynamicSpeed = minSpeed;
        } else if (bufferLength > 50) {
          // Medium mode: 2 chars at a time
          charsToTake = 2;
          dynamicSpeed = minSpeed * 2;
        }

        const chars = buffer.current.substring(0, charsToTake);
        buffer.current = buffer.current.substring(charsToTake);
        setDisplayedText(prev => prev + chars);

        timeoutRef.current = setTimeout(runTypewriter, dynamicSpeed);
      } else {
        setIsTyping(false);
        setIsComplete(true);
      }
    };

    runTypewriter();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isTyping, baseSpeed, minSpeed, maxBuffer]);

  return {
    displayedText,
    isTyping,
    isComplete,
    addChunk,
    skipToEnd,
    reset
  };
}
