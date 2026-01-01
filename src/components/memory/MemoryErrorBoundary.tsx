import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Brain, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class MemoryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Memory Error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'memory_error', {
        error_message: error.message,
        component_stack: errorInfo.componentStack
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  handleClearMemory = async () => {
    try {
      // Clear IndexedDB memory store
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('SwissVaultMemory');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      // Reload page
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear memory:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isIndexedDBError = this.state.error?.message?.includes('IndexedDB') ||
                               this.state.error?.message?.includes('IDB');
      const isModelError = this.state.error?.message?.includes('model') ||
                          this.state.error?.message?.includes('Transformers');

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Memory System Error
              </CardTitle>
              <CardDescription>
                Something went wrong with the AI memory system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="font-mono text-xs mt-2 break-all">
                  {this.state.error?.message || 'Unknown error'}
                </AlertDescription>
              </Alert>

              {isIndexedDBError && (
                <Alert>
                  <HardDrive className="h-4 w-4" />
                  <AlertTitle>Storage Issue</AlertTitle>
                  <AlertDescription>
                    There's a problem with browser storage. Try clearing memory data or using a different browser.
                  </AlertDescription>
                </Alert>
              )}

              {isModelError && (
                <Alert>
                  <Brain className="h-4 w-4" />
                  <AlertTitle>Model Loading Issue</AlertTitle>
                  <AlertDescription>
                    The AI model couldn't load. Check your internet connection and try again.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button variant="outline" onClick={this.handleClearMemory} className="w-full">
                  <HardDrive className="h-4 w-4 mr-2" />
                  Clear Memory & Reload
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => window.location.href = '/chat'}
                  className="w-full"
                >
                  Continue Without Memory
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                If this problem persists, please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
