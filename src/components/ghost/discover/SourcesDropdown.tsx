import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { IconWorld } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface Source {
  id: string;
  label: string;
  enabled: boolean;
}

interface SourcesDropdownProps {
  module: 'patents' | 'legal' | 'research' | 'finance';
}

const getDefaultSources = (module: string): Source[] => {
  switch (module) {
    case 'patents':
      return [
        { id: 'uspto', label: 'USPTO', enabled: true },
        { id: 'epo', label: 'EPO', enabled: true },
        { id: 'wipo', label: 'WIPO', enabled: true },
        { id: 'google-patents', label: 'Google Patents', enabled: false },
      ];
    case 'legal':
      return [
        { id: 'legislation', label: 'Legislation', enabled: true },
        { id: 'case-law', label: 'Case Law', enabled: true },
        { id: 'regulatory', label: 'Regulatory Bodies', enabled: true },
        { id: 'academic', label: 'Academic', enabled: false },
      ];
    case 'research':
      return [
        { id: 'pubmed', label: 'PubMed', enabled: true },
        { id: 'arxiv', label: 'arXiv', enabled: true },
        { id: 'semantic-scholar', label: 'Semantic Scholar', enabled: true },
        { id: 'clinicaltrials', label: 'ClinicalTrials.gov', enabled: false },
      ];
    case 'finance':
      return [
        { id: 'sec', label: 'SEC Filings', enabled: true },
        { id: 'news', label: 'Financial News', enabled: true },
        { id: 'analyst', label: 'Analyst Reports', enabled: false },
        { id: 'social', label: 'Social Sentiment', enabled: false },
      ];
    default:
      return [];
  }
};

export function SourcesDropdown({ module }: SourcesDropdownProps) {
  const [sources, setSources] = useState<Source[]>(getDefaultSources(module));
  const activeCount = sources.filter(s => s.enabled).length;

  const toggleSource = (id: string) => {
    setSources(prev => 
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors",
            "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          )}
        >
          <IconWorld className="w-4 h-4" stroke={1.5} />
          <span className="text-xs font-medium">{activeCount}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-medium text-slate-500 px-2 py-1.5 mb-1">Sources</p>
        <div className="space-y-1">
          {sources.map((source) => (
            <div 
              key={source.id}
              className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm text-slate-700">{source.label}</span>
              <Switch 
                checked={source.enabled} 
                onCheckedChange={() => toggleSource(source.id)}
                className="scale-75"
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
