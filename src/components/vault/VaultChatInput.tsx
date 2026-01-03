import { useState, useRef, KeyboardEvent } from 'react';
import { Send, FileText, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { VoiceRecordingOverlay } from '@/components/voice/VoiceRecordingOverlay';
import { VoiceInputButton, VoiceOutputButton } from '@/components/voice/VoiceButtons';

interface VaultChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  lastAssistantMessage?: string;
  isLoading?: boolean;
  onUploadDocument?: () => void;
}

export function VaultChatInput({ 
  onSend, 
  disabled, 
  placeholder = "Message Vault Chat... (E2E encrypted)",
  lastAssistantMessage,
  isLoading,
  onUploadDocument,
}: VaultChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice Input Hook
  const voiceInput = useVoiceInput({
    onTranscription: (text) => {
      setInput(prev => prev ? `${prev} ${text}` : text);
      textareaRef.current?.focus();
    },
    language: 'en',
  });

  // Voice Output Hook
  const voiceOutput = useVoiceOutput({
    voice: 'nova',
    speed: 1.0,
  });

  const handleSend = () => {
    if (!input.trim() || disabled || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceToggle = () => {
    if (voiceInput.isRecording) {
      voiceInput.stopRecording();
    } else {
      voiceInput.startRecording();
    }
  };

  const handleTTSToggle = () => {
    if (lastAssistantMessage) {
      voiceOutput.toggle(lastAssistantMessage);
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full">
        {/* Voice Recording Overlay - Vault variant (blue) */}
        <VoiceRecordingOverlay
          isRecording={voiceInput.isRecording}
          duration={voiceInput.duration}
          onStop={voiceInput.stopRecording}
          onCancel={voiceInput.cancelRecording}
          variant="vault"
        />

        {/* Processing Indicator */}
        {voiceInput.isProcessing && (
          <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-primary">Transcribing securely...</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Main Input Area */}
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || voiceInput.isRecording || isLoading}
              className="min-h-[60px] max-h-[200px] resize-none pr-14"
              rows={1}
            />
            
            {/* Document Upload Button */}
            <div className="absolute right-2 bottom-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    disabled={disabled || isLoading}
                    onClick={onUploadDocument}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload document for context</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Voice Input Button */}
          <VoiceInputButton
            isRecording={voiceInput.isRecording}
            isProcessing={voiceInput.isProcessing}
            isSupported={voiceInput.isSupported}
            onToggle={handleVoiceToggle}
            disabled={disabled || isLoading}
          />

          {/* TTS Button */}
          {lastAssistantMessage && (
            <VoiceOutputButton
              isPlaying={voiceOutput.isPlaying}
              isLoading={voiceOutput.isLoading}
              onToggle={handleTTSToggle}
              disabled={disabled}
            />
          )}

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || disabled || voiceInput.isRecording || isLoading}
            className="h-10 w-10 shrink-0"
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Encryption indicator */}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Lock className="h-3 w-3 text-primary" />
          <span>End-to-end encrypted • Swiss data residency</span>
        </p>
      </div>
    </TooltipProvider>
  );
}
