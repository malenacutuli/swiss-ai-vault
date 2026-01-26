/**
 * Health Memory Section - Classifies and organizes health data in user memory
 * Integrates with Personal AI Memory for health-specific categorization
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Heart,
  Activity,
  FileText,
  Clock,
  Search,
  Filter,
  Trash2,
  Download,
  Shield,
  Smartphone,
  Stethoscope,
  Pill,
  TestTube,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Health memory categories
export type HealthMemoryCategory = 
  | 'consultation'    // Voice/chat consultations
  | 'symptom'         // Symptom reports
  | 'medication'      // Medication tracking
  | 'test_result'     // Lab/test results
  | 'vital_signs'     // From health devices
  | 'condition'       // Diagnosed conditions
  | 'document'        // Uploaded documents
  | 'general';        // General health notes

export interface HealthMemoryItem {
  id: string;
  category: HealthMemoryCategory;
  title: string;
  content: string;
  source: 'voice_chat' | 'text_chat' | 'upload' | 'device' | 'manual';
  createdAt: number;
  updatedAt: number;
  metadata?: {
    sessionId?: string;
    documentIds?: string[];
    deviceType?: string;
    severity?: 'low' | 'medium' | 'high';
    keywords?: string[];
  };
}

interface HealthMemorySectionProps {
  memories: HealthMemoryItem[];
  onDeleteMemory: (id: string) => Promise<void>;
  onExportMemories: () => void;
  onSearch: (query: string, category?: HealthMemoryCategory) => Promise<HealthMemoryItem[]>;
  className?: string;
}

const CATEGORY_CONFIG: Record<HealthMemoryCategory, { 
  icon: typeof Heart; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  consultation: { icon: Stethoscope, label: 'Consultations', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  symptom: { icon: AlertTriangle, label: 'Symptoms', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  medication: { icon: Pill, label: 'Medications', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  test_result: { icon: TestTube, label: 'Test Results', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  vital_signs: { icon: Activity, label: 'Vital Signs', color: 'text-red-600', bgColor: 'bg-red-50' },
  condition: { icon: Heart, label: 'Conditions', color: 'text-rose-600', bgColor: 'bg-rose-50' },
  document: { icon: FileText, label: 'Documents', color: 'text-slate-600', bgColor: 'bg-slate-50' },
  general: { icon: Brain, label: 'General', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
};

export function HealthMemorySection({
  memories,
  onDeleteMemory,
  onExportMemories,
  onSearch,
  className
}: HealthMemorySectionProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<HealthMemoryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HealthMemoryItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter memories by category
  const filteredMemories = activeCategory === 'all' 
    ? memories 
    : memories.filter(m => m.category === activeCategory);

  // Display memories (search results or filtered)
  const displayedMemories = searchResults || filteredMemories;

  // Category counts
  const categoryCounts = memories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await onSearch(
        searchQuery, 
        activeCategory === 'all' ? undefined : activeCategory
      );
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeCategory, onSearch]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t('ghost.health.memory.confirmDelete', 'Delete this health memory?'))) {
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteMemory(id);
    } finally {
      setDeletingId(null);
    }
  }, [onDeleteMemory, t]);

  // Clear search when category changes
  useEffect(() => {
    setSearchResults(null);
  }, [activeCategory]);

  if (memories.length === 0) {
    return (
      <Card className={cn("p-6 text-center", className)}>
        <Brain className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <h3 className="font-medium text-slate-600 mb-1">
          {t('ghost.health.memory.empty', 'No Health Memories')}
        </h3>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          {t('ghost.health.memory.emptyDesc', 
            'Your health consultations, symptom reports, and uploaded documents will be organized here for easy reference.'
          )}
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-emerald-600">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>{t('ghost.health.memory.encrypted', 'Encrypted')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('ghost.health.memory.localOnly', 'Device Only')}</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#2A8C86]/5 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#2A8C86]" />
            <h3 className="font-semibold text-slate-800">
              {t('ghost.health.memory.title', 'Health Memory')}
            </h3>
            <Badge variant="secondary">{memories.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportMemories}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            {t('ghost.health.memory.exportAll', 'Export All')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('ghost.health.memory.searchPlaceholder', 'Search health memories...')}
            className="w-full h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2A8C86]/20 focus:border-[#2A8C86]"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#2A8C86] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="p-2 border-b border-slate-100 overflow-x-auto">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory('all')}
            className={cn(
              "h-7 px-2.5 text-xs rounded-full whitespace-nowrap",
              activeCategory === 'all' 
                ? "bg-[#2A8C86]/10 text-[#2A8C86]" 
                : "text-slate-600"
            )}
          >
            All ({memories.length})
          </Button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            return (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                onClick={() => setActiveCategory(key as HealthMemoryCategory)}
                className={cn(
                  "h-7 px-2.5 text-xs rounded-full whitespace-nowrap gap-1",
                  activeCategory === key 
                    ? `${config.bgColor} ${config.color}` 
                    : "text-slate-600"
                )}
              >
                <config.icon className="w-3 h-3" />
                {config.label} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Memory List */}
      <ScrollArea className="max-h-[400px]">
        {displayedMemories.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            {searchQuery 
              ? t('ghost.health.memory.noResults', 'No memories found for your search')
              : t('ghost.health.memory.noCategory', 'No memories in this category')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedMemories.map((memory) => {
              const config = CATEGORY_CONFIG[memory.category];
              const Icon = config.icon;
              
              return (
                <div 
                  key={memory.id} 
                  className="p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      config.bgColor
                    )}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-medium text-slate-800 truncate">
                            {memory.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge 
                              variant="secondary" 
                              className={cn("text-[10px] h-5", config.bgColor, config.color)}
                            >
                              {config.label}
                            </Badge>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(memory.createdAt), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(memory.id)}
                          disabled={deletingId === memory.id}
                          className="h-6 w-6 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Preview */}
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {memory.content}
                      </p>

                      {/* Metadata */}
                      {memory.metadata?.keywords && memory.metadata.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {memory.metadata.keywords.slice(0, 4).map((keyword, i) => (
                            <span 
                              key={i}
                              className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Source indicator */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                        {memory.source === 'voice_chat' && '🎤 Voice Consultation'}
                        {memory.source === 'text_chat' && '💬 Chat'}
                        {memory.source === 'upload' && '📎 Uploaded Document'}
                        {memory.source === 'device' && '📱 Health Device'}
                        {memory.source === 'manual' && '✏️ Manual Entry'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span>{t('ghost.health.memory.privacyNote', 'All data encrypted and stored locally')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Helper function to classify health content into categories
 */
export function classifyHealthContent(content: string): HealthMemoryCategory {
  const lowerContent = content.toLowerCase();
  
  // Symptom indicators
  if (/pain|ache|fever|cough|headache|nausea|fatigue|dizzy|rash|swelling|symptom/i.test(lowerContent)) {
    return 'symptom';
  }
  
  // Medication indicators
  if (/medication|medicine|drug|dose|prescription|tablet|pill|mg|twice daily|once daily/i.test(lowerContent)) {
    return 'medication';
  }
  
  // Test result indicators
  if (/test result|lab|blood test|urine|cholesterol|glucose|hemoglobin|white blood|red blood/i.test(lowerContent)) {
    return 'test_result';
  }
  
  // Vital signs indicators
  if (/blood pressure|heart rate|bpm|pulse|temperature|oxygen|spo2|weight|bmi/i.test(lowerContent)) {
    return 'vital_signs';
  }
  
  // Condition indicators
  if (/diagnosed|condition|disease|disorder|syndrome|chronic|diabetes|hypertension|asthma/i.test(lowerContent)) {
    return 'condition';
  }
  
  return 'general';
}
