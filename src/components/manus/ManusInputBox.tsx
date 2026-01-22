import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Smile,
  Mic,
  ArrowUp,
  Link2,
  X,
  FileText,
  Globe,
  Smartphone,
  Wand2,
  ChevronDown,
  Calendar,
  Search,
  Table,
  BarChart3,
  Video,
  Music,
  MessageSquare,
  BookOpen,
  ExternalLink,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import integration logos
import gmailLogo from "@/assets/integrations/gmail-logo.png";
import slackLogo from "@/assets/integrations/slack-logo.png";
import notionLogo from "@/assets/integrations/notion-logo.png";
import githubLogo from "@/assets/integrations/github-logo.png";
import asanaLogo from "@/assets/integrations/asana-logo.png";

interface ManusInputBoxProps {
  onSubmit?: (value: string, mode?: string) => void;
  onFileAttach?: () => void;
  onConnectorClick?: (connectorType: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showToolBar?: boolean;
  showQuickActions?: boolean;
  connectedTools?: string[];
}

// Tool configuration with logos and Lucide icons
interface ToolIconConfig {
  id: string;
  name: string;
  logo?: string;
  LucideIcon?: LucideIcon;
}

const toolIcons: ToolIconConfig[] = [
  { id: "gmail", name: "Gmail", logo: gmailLogo },
  { id: "calendar", name: "Google Calendar", LucideIcon: Calendar },
  { id: "drive", name: "Google Drive", LucideIcon: HardDrive },
  { id: "github", name: "GitHub", logo: githubLogo },
  { id: "slack", name: "Slack", logo: slackLogo },
  { id: "notion", name: "Notion", logo: notionLogo },
  { id: "asana", name: "Asana", logo: asanaLogo },
];

// Quick action buttons
const quickActions = [
  { id: "slides", icon: FileText, label: "Create slides" },
  { id: "website", icon: Globe, label: "Build website" },
  { id: "apps", icon: Smartphone, label: "Develop apps" },
  { id: "design", icon: Wand2, label: "Design" },
];

// More dropdown items
const moreActions = [
  { id: "schedule", icon: Calendar, label: "Schedule task" },
  { id: "research", icon: Search, label: "Wide Research" },
  { id: "spreadsheet", icon: Table, label: "Spreadsheet" },
  { id: "visualization", icon: BarChart3, label: "Visualization" },
  { id: "video", icon: Video, label: "Video" },
  { id: "audio", icon: Music, label: "Audio" },
  { id: "chat", icon: MessageSquare, label: "Chat mode" },
  { id: "playbook", icon: BookOpen, label: "Playbook", external: true },
];

export function ManusInputBox({
  onSubmit,
  onFileAttach,
  onConnectorClick,
  placeholder = "Assign a task or ask anything",
  disabled = false,
  showToolBar = true,
  showQuickActions = true,
  connectedTools = [],
}: ManusInputBoxProps) {
  const [value, setValue] = useState("");
  const [showConnectBar, setShowConnectBar] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (actionId: string) => {
    const actionPrompts: Record<string, string> = {
      slides: "Create a presentation about ",
      website: "Build a website for ",
      apps: "Develop an app that ",
      design: "Design a ",
      schedule: "Schedule a task to ",
      research: "Research about ",
      spreadsheet: "Create a spreadsheet for ",
      visualization: "Create a visualization of ",
      video: "Create a video about ",
      audio: "Generate audio for ",
      chat: "",
      playbook: "",
    };

    if (actionId === "playbook") {
      window.open("/playbook", "_blank");
      return;
    }

    if (actionId === "chat") {
      onSubmit?.("", "chat");
      return;
    }

    setValue(actionPrompts[actionId] || "");
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Main Input Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 pt-4 pb-2 text-base resize-none border-none outline-none min-h-[60px] max-h-[200px] placeholder:text-gray-400"
          rows={1}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
          {/* Left Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onFileAttach}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Add files"
            >
              <Plus className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={() => onConnectorClick?.("github")}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${connectedTools.includes("github") ? "opacity-100" : "opacity-60"}`}
              title="Connect GitHub"
            >
              <img src={githubLogo} alt="GitHub" className="w-5 h-5 object-contain" />
            </button>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Add emoji"
            >
              <Smile className="w-5 h-5 text-gray-500" />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Voice input"
            >
              <Mic className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tool Connection Bar */}
      {showToolBar && showConnectBar && (
        <div className="flex items-center gap-4 mt-3 px-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link2 className="w-4 h-4" />
            <span>Connect your tools to SwissBrAIn</span>
          </div>

          <div className="flex items-center gap-1.5">
            {toolIcons.map((tool) => {
              const IconComponent = tool.LucideIcon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onConnectorClick?.(tool.id)}
                  className={`w-6 h-6 flex items-center justify-center transition-opacity cursor-pointer ${connectedTools.includes(tool.id) ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                  title={tool.name}
                >
                  {tool.logo ? (
                    <img src={tool.logo} alt={tool.name} className="w-5 h-5 object-contain" />
                  ) : IconComponent ? (
                    <IconComponent className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowConnectBar(false)}
            className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Quick Action Buttons */}
      {showQuickActions && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className="rounded-full px-4 py-2 h-auto gap-2 border-gray-200 hover:bg-gray-50"
                onClick={() => handleQuickAction(action.id)}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </Button>
            );
          })}

          {/* More Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full px-4 py-2 h-auto gap-2 bg-gray-100 border-gray-200 hover:bg-gray-200"
              >
                More
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {moreActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => handleQuickAction(action.id)}
                    className="cursor-pointer"
                  >
                    <Icon className="w-4 h-4 mr-3 text-gray-500" />
                    <span className="flex-1">{action.label}</span>
                    {action.external && (
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export default ManusInputBox;
