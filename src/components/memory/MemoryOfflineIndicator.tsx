import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MemoryOfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <Alert 
      variant={isOnline ? 'default' : 'destructive'} 
      className="mb-4"
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <AlertDescription>
            Back online! Memory sync will resume.
          </AlertDescription>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You're offline. Memory works locally, sync paused.
          </AlertDescription>
        </>
      )}
    </Alert>
  );
}
