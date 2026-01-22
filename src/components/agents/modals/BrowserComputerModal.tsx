import React, { useState, useEffect } from 'react';
import { X, Monitor, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface TimelineStep {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  screenshotUrl?: string;
}

interface BrowserComputerModalProps {
  isOpen: boolean;
  onClose: () => void;
  browserState: {
    status: 'idle' | 'navigating' | 'clicking' | 'typing' | 'scrolling' | 'waiting';
    currentUrl: string;
    tabs: BrowserTab[];
    screenshotUrl?: string;
  };
  timeline: {
    steps: TimelineStep[];
    currentStepIndex: number;
    isLive: boolean;
  };
  onStepChange?: (stepIndex: number) => void;
}

const statusLabels: Record<string, string> = {
  idle: 'Browser ready',
  navigating: 'Navigating to page',
  clicking: 'Clicking element',
  typing: 'Typing text',
  scrolling: 'Scrolling page',
  waiting: 'Waiting for page load',
};

export const BrowserComputerModal: React.FC<BrowserComputerModalProps> = ({
  isOpen,
  onClose,
  browserState,
  timeline,
  onStepChange,
}) => {
  const [sliderValue, setSliderValue] = useState(timeline.currentStepIndex);

  useEffect(() => {
    setSliderValue(timeline.currentStepIndex);
  }, [timeline.currentStepIndex]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    onStepChange?.(value);
  };

  const handlePrevStep = () => {
    if (sliderValue > 0) {
      const newValue = sliderValue - 1;
      setSliderValue(newValue);
      onStepChange?.(newValue);
    }
  };

  const handleNextStep = () => {
    if (sliderValue < timeline.steps.length - 1) {
      const newValue = sliderValue + 1;
      setSliderValue(newValue);
      onStepChange?.(newValue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">SwissVault Computer</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {browserState.status !== 'idle' && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              )}
              <span>SwissVault is using Browser</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">{statusLabels[browserState.status]}</span>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* URL Bar */}
        <div className="px-6 py-3 border-b bg-gray-100/50">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border text-sm">
            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-600 truncate flex-1">{browserState.currentUrl || 'about:blank'}</span>
            {browserState.currentUrl && (
              <a
                href={browserState.currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 text-xs"
              >
                Open
              </a>
            )}
          </div>
        </div>

        {/* Browser View */}
        <div className="flex-1 p-6 bg-gray-900 overflow-hidden min-h-[400px]">
          {/* Fake Browser Chrome */}
          <div className="bg-gray-800 rounded-t-lg">
            {/* Tab Bar */}
            <div className="flex items-center gap-1 px-2 pt-2">
              {browserState.tabs.length > 0 ? (
                browserState.tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs max-w-[200px]",
                      tab.isActive
                        ? "bg-white text-gray-800"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    )}
                  >
                    <span className="truncate">{tab.title || 'New Tab'}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs bg-white text-gray-800">
                  <span>New Tab</span>
                </div>
              )}
              <div className="px-2 py-1.5 text-gray-500 hover:bg-gray-700 rounded cursor-pointer text-sm">
                +
              </div>
            </div>

            {/* URL Bar in Browser */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-b">
              <div className="flex items-center gap-2 flex-1 px-3 py-1.5 bg-gray-100 rounded text-xs text-gray-600">
                <span className="truncate">{browserState.currentUrl || 'about:blank'}</span>
              </div>
            </div>
          </div>

          {/* Browser Content */}
          <div className="bg-white rounded-b-lg overflow-hidden" style={{ height: 'calc(100% - 80px)' }}>
            {browserState.screenshotUrl ? (
              <img
                src={browserState.screenshotUrl}
                alt="Browser view"
                className="w-full h-full object-contain bg-gray-50"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                <div className="text-center">
                  {browserState.status !== 'idle' ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                      <p className="text-gray-600">{statusLabels[browserState.status]}...</p>
                      <p className="text-sm text-gray-400 mt-1">{browserState.currentUrl}</p>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Browser view will appear here</p>
                      <p className="text-sm mt-1">Waiting for browser activity...</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Step Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevStep}
                disabled={sliderValue === 0 || timeline.steps.length === 0}
                className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous step"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextStep}
                disabled={sliderValue >= timeline.steps.length - 1 || timeline.steps.length === 0}
                className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next step"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline Slider */}
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={Math.max(timeline.steps.length - 1, 0)}
                value={sliderValue}
                onChange={handleSliderChange}
                disabled={timeline.steps.length === 0}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Step Counter */}
            <div className="flex items-center gap-3 text-sm min-w-[100px] justify-end">
              <span className="text-gray-600 font-medium">
                {timeline.steps.length > 0 ? `${sliderValue + 1} / ${timeline.steps.length}` : '0 / 0'}
              </span>

              {/* Live Indicator */}
              {timeline.isLive && (
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">live</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Step Description */}
          {timeline.steps[sliderValue] && (
            <p className="mt-3 text-sm text-gray-600 bg-white px-3 py-2 rounded border">
              <span className="font-medium text-gray-700">{timeline.steps[sliderValue].action}:</span>{' '}
              {timeline.steps[sliderValue].description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowserComputerModal;
