import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, List } from 'lucide-react';
import { BrowserPreview } from './BrowserPreview';
import { BrowserActionLog } from './BrowserActionLog';
import { cn } from '@/lib/utils';

interface BrowserPanelProps {
  taskId: string;
  currentUrl?: string;
  currentScreenshot?: string;
  isLoading?: boolean;
  onNavigate?: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  className?: string;
}

export function BrowserPanel({
  taskId,
  currentUrl,
  currentScreenshot,
  isLoading,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onScreenshot,
  className,
}: BrowserPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('preview');

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="px-2 border-b">
          <TabsList className="h-9">
            <TabsTrigger value="preview" className="gap-1.5 text-xs">
              <Monitor className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5 text-xs">
              <List className="h-3.5 w-3.5" />
              Actions
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="flex-1 m-0 p-2">
          <BrowserPreview
            taskId={taskId}
            currentUrl={currentUrl}
            currentScreenshot={currentScreenshot}
            isLoading={isLoading}
            onNavigate={onNavigate}
            onBack={onBack}
            onForward={onForward}
            onRefresh={onRefresh}
            onScreenshot={onScreenshot}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="actions" className="flex-1 m-0 overflow-hidden">
          <BrowserActionLog
            taskId={taskId}
            maxHeight="100%"
            className="h-full"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
