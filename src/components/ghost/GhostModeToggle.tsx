import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Ghost, Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface GhostModeToggleProps {
  currentMode?: "ghost" | "vault";
  className?: string;
}

const STORAGE_KEY = "last_chat_mode";

export function GhostModeToggle({ currentMode, className }: GhostModeToggleProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showGhostToVaultModal, setShowGhostToVaultModal] = useState(false);
  const [showVaultToGhostModal, setShowVaultToGhostModal] = useState(false);

  // Determine current mode from prop or route
  const mode = currentMode || (location.pathname.includes("/ghost") ? "ghost" : "vault");

  // Persist preference to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const handleToggle = (targetMode: "ghost" | "vault") => {
    if (targetMode === mode) return;

    if (mode === "ghost" && targetMode === "vault") {
      setShowGhostToVaultModal(true);
    } else if (mode === "vault" && targetMode === "ghost") {
      setShowVaultToGhostModal(true);
    }
  };

  const confirmSwitchToVault = () => {
    setShowGhostToVaultModal(false);
    localStorage.setItem(STORAGE_KEY, "vault");
    navigate("/chat");
  };

  const confirmSwitchToGhost = () => {
    setShowVaultToGhostModal(false);
    localStorage.setItem(STORAGE_KEY, "ghost");
    navigate("/ghost");
  };

  return (
    <>
      <div
        className={cn(
          "relative flex items-center rounded-full p-1 bg-muted/50 border border-border/50",
          className
        )}
      >
        {/* Ghost Option */}
        <button
          onClick={() => handleToggle("ghost")}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
            mode === "ghost"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Ghost className="h-4 w-4" />
          <span>Ghost</span>
        </button>

        {/* Vault Option */}
        <button
          onClick={() => handleToggle("vault")}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
            mode === "vault"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Lock className="h-4 w-4" />
          <span>Vault</span>
        </button>

        {/* Sliding Background */}
        <div
          className={cn(
            "absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out",
            mode === "ghost"
              ? "left-1 bg-gradient-to-r from-purple-600 to-purple-500"
              : "bg-gradient-to-r from-emerald-600 to-emerald-500"
          )}
          style={{
            width: mode === "ghost" ? "calc(50% - 4px)" : "calc(50% - 4px)",
            left: mode === "ghost" ? "4px" : "calc(50%)",
          }}
        />
      </div>

      {/* Ghost to Vault Warning Modal */}
      <AlertDialog open={showGhostToVaultModal} onOpenChange={setShowGhostToVaultModal}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              Switch to VaultChat?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                VaultChat stores your conversations on SwissVault servers (encrypted).
              </p>
              <p className="text-muted-foreground">
                Your Ghost conversations will remain local on this device.
              </p>
              <p>Do you want to switch?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-purple-600 hover:bg-purple-700 text-white border-0">
              Stay in Ghost
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchToVault}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Switch to VaultChat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vault to Ghost Info Modal */}
      <AlertDialog open={showVaultToGhostModal} onOpenChange={setShowVaultToGhostModal}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ghost className="h-5 w-5 text-purple-500" />
              Entering Ghost Mode
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Ghost Mode stores nothing on SwissVault servers.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">•</span>
                  Conversations exist only on your device
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">•</span>
                  Swiss-hosted AI models only
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-400">•</span>
                  Export your data anytime
                </li>
              </ul>
              <p className="font-medium text-foreground">Ready to go invisible?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchToGhost}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Enter Ghost Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Utility to get preferred mode on app load
export function getPreferredChatMode(): "ghost" | "vault" {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ghost" ? "ghost" : "vault";
}
