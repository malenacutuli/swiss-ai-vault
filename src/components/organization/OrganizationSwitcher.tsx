import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Building2, ChevronDown, Plus, User, Check, Loader2 } from "lucide-react";
import {
  useCurrentOrganization,
  useOrganizations,
  useCreateOrganization,
} from "@/hooks/useOrganization";

interface OrganizationSwitcherProps {
  collapsed: boolean;
}

export function OrganizationSwitcher({ collapsed }: OrganizationSwitcherProps) {
  const { currentOrg, setCurrentOrganization, isPersonalWorkspace } = useCurrentOrganization();
  const { organizations, refetch } = useOrganizations();
  const { createOrganization, loading: createLoading } = useCreateOrganization();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    
    const org = await createOrganization(newOrgName.trim());
    if (org) {
      await setCurrentOrganization(org.id);
      refetch();
      setIsCreateModalOpen(false);
      setNewOrgName("");
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

  const currentName = isPersonalWorkspace ? "Personal Workspace" : currentOrg?.name || "Select Workspace";

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
              <AvatarFallback className="rounded-md bg-primary/20 text-primary text-xs">
                {isPersonalWorkspace ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  getOrgInitials(currentOrg?.name || "O")
                )}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {currentName}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-popover border border-border shadow-lg z-[100]" sideOffset={8}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Workspace
          </DropdownMenuLabel>
          
          {/* Personal Workspace */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCurrentOrganization(null);
              setIsDropdownOpen(false);
            }}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span className="flex-1">Personal Workspace</span>
            {isPersonalWorkspace && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
          
          {organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    setCurrentOrganization(org.id);
                    setIsDropdownOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {currentOrg?.id === org.id && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsDropdownOpen(false);
              setIsCreateModalOpen(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Organization Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
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
