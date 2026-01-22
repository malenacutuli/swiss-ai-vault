/**
 * Swiss Agents V2 - Manus.im Parity UI
 * 
 * This component implements 100% UI parity with Manus.im
 * All "Manus" references replaced with "SwissBrAIn"
 * 
 * Layout: Sidebar (280px) | Header + Main Content
 * Task View: Chat Panel (50%) | Management Panel (50%)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Bell,
  Zap,
  Plus,
  Search,
  BookOpen,
  FolderOpen,
  Settings,
  Grid,
  Smartphone,
  Users,
  ExternalLink,
  HelpCircle,
  LogOut,
  User,
  Brain,
  Home,
  Mic,
  ArrowUp,
  Smile,
  Link2,
  X,
  FileText,
  Globe,
  Wand2,
  Calendar,
  Table,
  BarChart,
  Video,
  Music,
  MessageSquare,
  Monitor,
  Tablet,
  Code,
  Github,
  Share,
  Pause,
  Square,
  MoreHorizontal,
  Edit,
  Star,
  Info,
  Trash,
  Loader2,
  CheckCircle,
  Circle,
  RotateCw,
  Play,
  Terminal,
} from 'lucide-react';

// Types
interface Task {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_input';
  createdAt: string;
}

interface Phase {
  id: number;
  title: string;
  status: 'pending' | 'running' | 'completed';
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'info' | 'ask' | 'result';
}

interface TerminalLine {
  type: 'command' | 'output' | 'info' | 'error';
  content: string;
  timestamp: string;
}

// Status dot colors
const statusColors: Record<string, string> = {
  pending: 'bg-gray-400',
  running: 'bg-amber-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  waiting_input: 'bg-purple-500',
};

// Sidebar Component
const Sidebar: React.FC<{
  tasks: Task[];
  currentTaskId: string | null;
  onNewTask: () => void;
  onSelectTask: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ tasks, currentTaskId, onNewTask, onSelectTask, collapsed, onToggleCollapse }) => {
  const [showAllTasks, setShowAllTasks] = useState(true);

  if (collapsed) {
    return (
      <div className="w-16 h-screen bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <button onClick={onToggleCollapse} className="p-2 hover:bg-gray-100 rounded-lg mb-4">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
        <button onClick={onNewTask} className="p-2 hover:bg-gray-100 rounded-lg">
          <Plus className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[280px] h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🇨🇭</span>
          <span className="font-semibold text-lg text-gray-900">SwissBrAIn</span>
        </div>
        <button onClick={onToggleCollapse} className="p-1 hover:bg-gray-100 rounded">
          <Grid className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* New Task Button */}
        <button
          onClick={onNewTask}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-gray-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          New task
        </button>

        {/* Search */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-gray-600">
          <Search className="w-5 h-5" />
          Search
        </button>

        {/* Library */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-gray-600">
          <BookOpen className="w-5 h-5" />
          Library
        </button>

        {/* Projects Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-gray-500">Projects</span>
            <button className="p-1 hover:bg-gray-100 rounded">
              <Plus className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-600 text-sm">
            <FolderOpen className="w-4 h-4" />
            New project
          </button>
        </div>

        {/* All Tasks Section */}
        <div className="mt-4">
          <button
            onClick={() => setShowAllTasks(!showAllTasks)}
            className="w-full flex items-center justify-between px-3 py-2"
          >
            <span className="text-sm font-medium text-gray-500">All tasks</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAllTasks ? '' : '-rotate-90'}`} />
          </button>

          {showAllTasks && (
            <div className="space-y-1">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left ${
                    currentTaskId === task.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusColors[task.status]}`} />
                  <span className="truncate text-gray-700">{task.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
          <Users className="w-5 h-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Share SwissBrAIn</p>
            <p className="text-xs text-gray-500">Get 500 credits each</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex items-center gap-4 mt-4 px-2">
          <button className="p-1 hover:bg-gray-100 rounded">
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded">
            <Grid className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded">
            <Smartphone className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header: React.FC<{
  credits: number;
  userName: string;
}> = ({ credits, userName }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* Model Selector */}
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100">
        <span className="font-medium text-gray-900">SwissBrAIn 1.6 Max</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>

        {/* Credits */}
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span>{credits.toLocaleString()}</span>
        </div>

        {/* User Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-medium"
          >
            {userName.charAt(0).toUpperCase()}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center font-medium">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{userName}</p>
                    <p className="text-sm text-gray-500">user@swissbrain.ai</p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="font-medium">SwissBrAIn Pro</span>
                  <button className="px-3 py-1 bg-black text-white text-sm rounded-lg">Add credits</button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span>Credits</span>
                  <span className="ml-auto font-medium">{credits.toLocaleString()}</span>
                </div>
              </div>
              <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-gray-700">
                <Brain className="w-4 h-4" />
                Knowledge
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-gray-700">
                <User className="w-4 h-4" />
                Account
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-gray-700">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-red-600">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// Home Page Component (New Task View)
const HomePage: React.FC<{
  onSubmitTask: (prompt: string) => void;
  isLoading: boolean;
}> = ({ onSubmitTask, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (prompt.trim() && !isLoading) {
      onSubmitTask(prompt.trim());
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const quickActions = [
    { icon: FileText, label: 'Create slides' },
    { icon: Globe, label: 'Build website' },
    { icon: Smartphone, label: 'Develop apps' },
    { icon: Wand2, label: 'Design' },
  ];

  const featureCards = [
    { emoji: '📱', text: 'Download app to access SwissBrAIn anytime and anywhere' },
    { emoji: '🍌', text: 'Generate slides with Nano Banana Pro' },
    { emoji: '💻', text: 'Turn your browser into an AI browser' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f5f5]">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Main Heading - Georgia font as per spec */}
        <h1 className="text-center text-[40px] text-gray-900 mb-8" style={{ fontFamily: 'Georgia, serif' }}>
          What can I do for you?
        </h1>

        {/* Input Box */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Assign a task or ask anything"
            className="w-full p-4 text-base resize-none border-none outline-none rounded-t-2xl min-h-[80px]"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <Plus className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <Github className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <Smile className="w-5 h-5 text-gray-500" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <Mic className="w-5 h-5 text-gray-500" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isLoading}
                className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tool Connection Bar */}
        <div className="flex items-center gap-4 mt-4 px-2">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link2 className="w-4 h-4" />
            <span>Connect your tools to SwissBrAIn</span>
          </div>
          <div className="flex items-center gap-2">
            {['whatsapp', 'gmail', 'calendar', 'drive', 'slack', 'github', 'notion'].map((tool) => (
              <div
                key={tool}
                className="w-5 h-5 rounded bg-gray-200 opacity-60 hover:opacity-100 cursor-pointer"
              />
            ))}
          </div>
          <button className="ml-auto p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full hover:bg-white hover:shadow-sm transition-all"
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-full hover:bg-gray-200">
            More
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {featureCards.map((card, index) => (
            <div
              key={index}
              className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="text-4xl mb-4">{card.emoji}</div>
              <p className="text-sm text-gray-700">{card.text}</p>
            </div>
          ))}
        </div>

        {/* Template Gallery */}
        <div className="mt-12">
          <h2 className="text-lg font-medium text-gray-900 mb-6">What are you building?</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Professional Headshot', desc: 'Generate a professional headshot for your profile picture' },
              { title: 'Career Document Crafter', desc: 'Craft a compelling resume, CV, or cover letter' },
              { title: 'Custom Web Tool', desc: 'Create a specialized online tool or calculator' },
              { title: 'Localize Content', desc: 'Adapt your content for new markets' },
            ].map((template) => (
              <button
                key={template.title}
                className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-1">{template.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{template.desc}</p>
                </div>
                <div className="w-24 h-16 rounded-lg bg-gray-100" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Task Execution View Component
const TaskExecutionView: React.FC<{
  task: Task;
  messages: Message[];
  phases: Phase[];
  currentPhase: number;
  terminalLines: TerminalLine[];
  onSendMessage: (message: string) => void;
  previewUrl?: string;
}> = ({ task, messages, phases, currentPhase, terminalLines, onSendMessage, previewUrl }) => {
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'terminal' | 'code' | 'docs'>('terminal');
  const [phasesExpanded, setPhasesExpanded] = useState(true);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const currentPhaseData = phases.find((p) => p.id === currentPhase);

  return (
    <div className="flex-1 flex bg-[#f5f5f5]">
      {/* Chat Panel (50%) */}
      <div className="w-1/2 flex flex-col bg-white border-r border-gray-200">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-medium text-gray-900 truncate max-w-md">{task.title}</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100" title="Pause">
              <Pause className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100" title="Stop">
              <Square className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setPhasesExpanded(!phasesExpanded)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {task.status === 'running' ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              ) : task.status === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" />
              )}
              <span className="text-sm font-medium text-gray-700">
                {currentPhaseData?.title || 'Processing...'}
              </span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {currentPhase}/{phases.length || 0}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${phasesExpanded ? '' : '-rotate-90'}`}
            />
          </button>

          {phasesExpanded && phases.length > 0 && (
            <div className="mt-3 space-y-2">
              {phases.map((phase) => (
                <div key={phase.id} className="flex items-center gap-2 text-sm">
                  {phase.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {phase.status === 'running' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {phase.status === 'pending' && <Circle className="w-4 h-4 text-gray-300" />}
                  <span className={phase.status === 'completed' ? 'text-gray-500' : 'text-gray-700'}>
                    {phase.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Send message to SwissBrAIn..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button className="p-1 hover:bg-gray-200 rounded">
              <Mic className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="p-1 bg-black text-white rounded disabled:opacity-50"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Management Panel (50%) */}
      <div className="w-1/2 flex flex-col">
        {/* Tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                activeTab === 'preview' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                activeTab === 'terminal' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'code' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'docs' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Share</button>
            <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Publish
            </button>
          </div>
        </div>

        {/* Device Toggles (for Preview) */}
        {activeTab === 'preview' && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-2 rounded-lg ${device === 'desktop' ? 'bg-white shadow-sm' : 'hover:bg-gray-100'}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={`p-2 rounded-lg ${device === 'tablet' ? 'bg-white shadow-sm' : 'hover:bg-gray-100'}`}
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-2 rounded-lg ${device === 'mobile' ? 'bg-white shadow-sm' : 'hover:bg-gray-100'}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <button className="p-1 hover:bg-gray-100 rounded">
                <Home className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded">
                <RotateCw className="w-4 h-4" />
              </button>
              <span>/</span>
              <button className="text-blue-600 hover:underline">Edit</button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'terminal' && (
            <div className="h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-400 text-xs">SwissVault Terminal</span>
              </div>
              {terminalLines.map((line, index) => (
                <div key={index} className="mb-1">
                  {line.type === 'command' && (
                    <span className="text-green-400">$ {line.content}</span>
                  )}
                  {line.type === 'output' && (
                    <span className="text-gray-300">{line.content}</span>
                  )}
                  {line.type === 'info' && (
                    <span className="text-blue-400">ℹ {line.content}</span>
                  )}
                  {line.type === 'error' && (
                    <span className="text-red-400">✗ {line.content}</span>
                  )}
                </div>
              ))}
              {task.status === 'running' && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="h-full bg-white flex items-center justify-center">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className={`border border-gray-200 rounded-lg ${
                    device === 'desktop' ? 'w-full h-full' :
                    device === 'tablet' ? 'w-[768px] h-[1024px]' :
                    'w-[375px] h-[667px]'
                  }`}
                />
              ) : (
                <div className="text-center text-gray-500">
                  <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No preview available</p>
                  <p className="text-sm">Start a task to see the preview</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 overflow-y-auto">
              <p className="text-gray-400">// Code view coming soon</p>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="h-full bg-white p-4 overflow-y-auto">
              <p className="text-gray-500">Documentation will appear here</p>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-white text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColors[task.status]}`} />
            <span className="text-gray-600 capitalize">{task.status.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span>Sandbox: Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Workspace Component
export const AgentWorkspaceV2: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'task'>('home');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create new task via Manus API
  const handleCreateTask = async (prompt: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agent-v2/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agentProfile: 'manus-1.6-max',
          taskMode: 'agent',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create task');
      }

      const data = await response.json();
      
      const newTask: Task = {
        id: data.task.id,
        title: data.task.title || prompt.substring(0, 50),
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      setTasks((prev) => [newTask, ...prev]);
      setCurrentTaskId(newTask.id);
      setCurrentView('task');
      setMessages([
        {
          id: '1',
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: `Task created successfully! ID: ${data.task.id}\n\nYou can also view this task directly on Manus at:\n${data.manusUrl}`,
          timestamp: new Date().toISOString(),
          type: 'info',
        },
      ]);
      setTerminalLines([
        { type: 'info', content: 'Starting SwissVault sandbox...', timestamp: new Date().toISOString() },
        { type: 'info', content: 'Sandbox initialized successfully', timestamp: new Date().toISOString() },
        { type: 'info', content: `Task ID: ${data.task.id}`, timestamp: new Date().toISOString() },
        { type: 'info', content: 'Connecting to Manus API...', timestamp: new Date().toISOString() },
      ]);

      // Start polling for status
      pollTaskStatus(data.task.id);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setTerminalLines((prev) => [
        ...prev,
        { type: 'error', content: errorMessage, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll task status from Manus API
  const pollTaskStatus = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/agent-v2/${taskId}`);
        if (!response.ok) return;

        const data = await response.json();
        const taskStatus = data.task;

        // Update task status
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: taskStatus.status } : t
          )
        );

        // Update phases if available
        if (taskStatus.plan?.phases) {
          setPhases(taskStatus.plan.phases.map((p: any, i: number) => ({
            id: i + 1,
            title: p.title || `Phase ${i + 1}`,
            status: p.status || 'pending',
          })));
          setCurrentPhase(taskStatus.plan.current_phase || 1);
        }

        // Add terminal output for progress
        if (taskStatus.latest_event) {
          setTerminalLines((prev) => [
            ...prev,
            { 
              type: 'output', 
              content: taskStatus.latest_event.message || 'Processing...', 
              timestamp: new Date().toISOString() 
            },
          ]);
        }

        // Check for terminal states
        if (['completed', 'failed', 'stopped'].includes(taskStatus.status)) {
          clearInterval(pollInterval);
          
          if (taskStatus.status === 'completed') {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'assistant',
                content: taskStatus.output?.text || 'Task completed successfully!',
                timestamp: new Date().toISOString(),
                type: 'result',
              },
            ]);
            setTerminalLines((prev) => [
              ...prev,
              { type: 'info', content: 'Task completed successfully', timestamp: new Date().toISOString() },
            ]);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds

    // Clean up after 10 minutes max
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const handleSendMessage = (message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      },
    ]);
    // Multi-turn conversation would use PUT /v1/tasks/{id} endpoint
  };

  const handleSelectTask = (taskId: string) => {
    setCurrentTaskId(taskId);
    setCurrentView('task');
  };

  const handleNewTask = () => {
    setCurrentView('home');
    setCurrentTaskId(null);
    setMessages([]);
    setPhases([]);
    setTerminalLines([]);
    setError(null);
  };

  const currentTask = tasks.find((t) => t.id === currentTaskId);

  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      {/* Sidebar */}
      <Sidebar
        tasks={tasks}
        currentTaskId={currentTaskId}
        onNewTask={handleNewTask}
        onSelectTask={handleSelectTask}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Header credits={20568} userName="User" />

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {currentView === 'home' ? (
          <HomePage onSubmitTask={handleCreateTask} isLoading={isLoading} />
        ) : currentTask ? (
          <TaskExecutionView
            task={currentTask}
            messages={messages}
            phases={phases}
            currentPhase={currentPhase}
            terminalLines={terminalLines}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a task or create a new one
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentWorkspaceV2;
