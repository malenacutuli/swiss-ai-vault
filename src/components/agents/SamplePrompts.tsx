import { 
  Monitor,
  Globe, 
  Smartphone, 
  Palette, 
  Calendar, 
  Search, 
  Table2, 
  BarChart3, 
  Video, 
  Volume2, 
  MessageSquare, 
  Book,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentMode } from './ModeSelector';

interface SamplePrompt {
  text: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// Prompts organized by mode
const PROMPTS_BY_MODE: Record<AgentMode | 'default', SamplePrompt[]> = {
  default: [
    { text: "Create a pitch deck for my startup", icon: Monitor },
    { text: "Research the competitive landscape in my industry", icon: Search },
    { text: "Build a dashboard to visualize my sales data", icon: BarChart3 },
    { text: "Write a comprehensive market analysis report", icon: Sparkles },
  ],
  slides: [
    { text: "Create a pitch deck for my startup" },
    { text: "Make a quarterly business review presentation" },
    { text: "Design a product launch slideshow" },
    { text: "Build a training presentation with speaker notes" },
  ],
  website: [
    { text: "Build a landing page for my SaaS product" },
    { text: "Create a portfolio website for my agency" },
    { text: "Design an e-commerce storefront" },
    { text: "Make a documentation site for my API" },
  ],
  apps: [
    { text: "Create a task management app with Kanban boards" },
    { text: "Build a customer feedback collection tool" },
    { text: "Design an expense tracking application" },
    { text: "Make a team collaboration dashboard" },
  ],
  design: [
    { text: "Generate a logo for my tech company" },
    { text: "Create social media graphics for my brand" },
    { text: "Design marketing banners for a campaign" },
    { text: "Make infographics from my data" },
  ],
  schedule: [
    { text: "Set up automated weekly reports" },
    { text: "Schedule daily data backups" },
    { text: "Create a recurring task for invoice generation" },
    { text: "Automate email notifications for my team" },
  ],
  research: [
    { text: "Analyze the competitive landscape for fintech in Europe" },
    { text: "Research best practices for GDPR compliance" },
    { text: "Deep dive into Swiss banking regulations" },
    { text: "Compare AI platforms for enterprise use" },
  ],
  spreadsheet: [
    { text: "Create a financial model for my startup" },
    { text: "Build a project timeline with dependencies" },
    { text: "Make an inventory tracking spreadsheet" },
    { text: "Design a sales pipeline tracker" },
  ],
  visualization: [
    { text: "Create a dashboard for my sales metrics" },
    { text: "Visualize customer acquisition funnel" },
    { text: "Build charts comparing quarterly performance" },
    { text: "Make an interactive map of regional data" },
  ],
  video: [
    { text: "Create an explainer video for my product" },
    { text: "Generate a video summary of my report" },
    { text: "Make a promotional clip for social media" },
    { text: "Build a tutorial walkthrough video" },
  ],
  audio: [
    { text: "Create a podcast summary of my document" },
    { text: "Generate an audio briefing of today's news" },
    { text: "Convert this report to a voice memo" },
    { text: "Make an audio overview for my team" },
  ],
  chat: [
    { text: "Help me brainstorm ideas for my next project" },
    { text: "Explain complex financial concepts simply" },
    { text: "Review my business plan and give feedback" },
    { text: "Answer questions about Swiss regulations" },
  ],
  playbook: [
    { text: "Use the sales outreach template" },
    { text: "Follow the investor pitch framework" },
    { text: "Apply the market research workflow" },
    { text: "Run the customer interview script" },
  ],
};

interface SamplePromptsProps {
  mode: AgentMode | 'default';
  onPromptSelect: (prompt: string) => void;
}

export function SamplePrompts({ mode, onPromptSelect }: SamplePromptsProps) {
  const prompts = PROMPTS_BY_MODE[mode] || PROMPTS_BY_MODE.default;
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {prompts.map((prompt, index) => (
        <button
          key={index}
          onClick={() => onPromptSelect(prompt.text)}
          className={cn(
            "p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer",
            "text-left transition-all duration-150",
            "border border-transparent hover:border-gray-200",
            "group"
          )}
        >
          <p className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">
            {prompt.text}
          </p>
        </button>
      ))}
    </div>
  );
}

// Export prompts for use in other components
export function getPromptsForMode(mode: AgentMode | 'default'): string[] {
  return (PROMPTS_BY_MODE[mode] || PROMPTS_BY_MODE.default).map(p => p.text);
}
