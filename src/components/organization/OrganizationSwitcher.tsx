import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown, Plus, Check, Loader2, Settings } from "lucide-react";
import { useOrganizationContext } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrganizationSwitcherProps {
  collapsed: boolean;
}

export function OrganizationSwitcher({ collapsed }: OrganizationSwitcherProps) {
  const { 
    currentOrganization, 
    organizations, 
    switchOrganization, 
    loading, 
    refreshOrganizations 
  } = useOrganizationContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    
    setCreateLoading(true);
    try {
      const slug = generateSlug(newOrgName);
      
      const { error } = await supabase.rpc('create_organization_with_owner', {
        p_name: newOrgName.trim(),
        p_slug: slug,
      });

      if (error) throw error;

      toast({
        title: 'Organization created',
        description: `${newOrgName} has been created successfully.`,
      });

      setIsCreateModalOpen(false);
      setNewOrgName("");
      await refreshOrganizations();
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error creating organization',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const getOrgInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg bg-sidebar-accent/50 animate-pulse",
        collapsed ? "h-10 w-10 justify-center" : "h-11 px-2"
      )}>
        {!collapsed && <div className="h-4 w-24 bg-sidebar-accent rounded" />}
      </div>
    );
  }

  if (!currentOrganization) {
    return null;
  }

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent",
              collapsed && "justify-center"
            )}
          >
            <Avatar className="h-7 w-7 rounded-md">
              <AvatarImage src={currentOrganization.avatar_url || undefined} />
              <AvatarFallback className="rounded-md bg-primary/20 text-primary text-xs">
                {getOrgInitials(currentOrganization.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {currentOrganization.name}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-64 bg-popover border border-border shadow-lg z-[100]" 
          sideOffset={8}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Organization
          </DropdownMenuLabel>
          
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={(e) => {
                e.preventDefault();
                if (org.id !== currentOrganization.id) {
                  switchOrganization(org.id);
                }
                setIsDropdownOpen(false);
              }}
              className="cursor-pointer"
            >
              <Avatar className="mr-2 h-5 w-5 rounded">
                <AvatarImage src={org.avatar_url || undefined} />
                <AvatarFallback className="rounded bg-primary/20 text-primary text-[10px]">
                  {getOrgInitials(org.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{org.name}</span>
              {currentOrganization.id === org.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsDropdownOpen(false);
              navigate('/dashboard/settings');
            }}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Organization Settings
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsDropdownOpen(false);
              setIsCreateModalOpen(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Organization Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create Organization
            </DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Company"
                className="bg-secondary border-border"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrg}
              disabled={!newOrgName.trim() || createLoading}
            >
              {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
