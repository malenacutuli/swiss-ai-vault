import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronDown,
  Bell,
  Zap,
  Brain,
  User,
  Settings,
  Home,
  HelpCircle,
  LogOut,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ManusHeaderProps {
  credits?: number;
  notifications?: number;
}

const models = [
  { id: "max", name: "SwissBrAIn 1.6 Max", description: "Most capable model" },
  { id: "pro", name: "SwissBrAIn 1.6 Pro", description: "Balanced performance" },
  { id: "lite", name: "SwissBrAIn 1.6 Lite", description: "Fast and efficient" },
];

export function ManusHeader({ credits: propCredits, notifications = 0 }: ManusHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState(models[0]);

  // Default credits - in production this would come from billing API
  const credits = propCredits ?? 20568;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || 'user@example.com';
  const userAvatar = user?.user_metadata?.avatar_url;

  return (
    <header className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-4">
      {/* Left - Model Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          <span className="font-medium text-gray-900">{selectedModel.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => setSelectedModel(model)}
              className="flex flex-col items-start py-3"
            >
              <span className="font-medium">{model.name}</span>
              <span className="text-xs text-gray-500">{model.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right - Notifications, Credits, User */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* Credits Display */}
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span>{credits.toLocaleString()}</span>
        </div>

        {/* User Avatar with Dropdown */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-gray-200 transition-all">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="bg-amber-600 text-white text-sm font-medium">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={userAvatar} />
                    <AvatarFallback className="bg-amber-600 text-white">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{userName}</p>
                    <p className="text-sm text-gray-500 truncate">{userEmail}</p>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Plan Info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">SwissBrAIn Pro</span>
                  <Button 
                    size="sm" 
                    className="h-7 px-3 text-xs bg-gray-900 hover:bg-gray-800"
                    onClick={() => navigate('/billing')}
                  >
                    Add credits
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-600">Credits</span>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                  <span className="ml-auto font-medium text-gray-900">{credits.toLocaleString()}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <button className="text-sm text-gray-500 hover:text-gray-700 mt-2 flex items-center gap-1">
                  Explore what's in SwissBrAIn Pro
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <DropdownMenuItem 
                  className="px-4 py-2.5 cursor-pointer"
                  onClick={() => navigate('/knowledge')}
                >
                  <Brain className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Knowledge</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="px-4 py-2.5 cursor-pointer"
                  onClick={() => navigate('/account')}
                >
                  <User className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="px-4 py-2.5 cursor-pointer"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="w-4 h-4 mr-3 text-gray-500" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="px-4 py-2.5 cursor-pointer">
                  <Home className="w-4 h-4 mr-3 text-gray-500" />
                  <span className="flex-1">Homepage</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </DropdownMenuItem>
                <DropdownMenuItem className="px-4 py-2.5 cursor-pointer">
                  <HelpCircle className="w-4 h-4 mr-3 text-gray-500" />
                  <span className="flex-1">Get help</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator />

              {/* Sign Out */}
              <DropdownMenuItem
                className="px-4 py-2.5 cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/login')}
          >
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}

export default ManusHeader;
