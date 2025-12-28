import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          "relative grid grid-cols-2 items-center rounded-full p-1 bg-muted/50 border border-border/50",
          className
        )}
      >
        {/* Sliding Background */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-1 w-1/2 rounded-full transition-transform duration-300 ease-out",
            mode === "vault" && "translate-x-full",
            mode === "vault" ? "bg-primary" : "bg-secondary"
          )}
        />

        {/* Ghost Option */}
        <button
          type="button"
          onClick={() => handleToggle("ghost")}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors min-w-[88px] justify-center",
            mode === "ghost"
              ? "text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Ghost className="h-4 w-4" />
          <span>Ghost</span>
        </button>

        {/* Vault Option */}
        <button
          type="button"
          onClick={() => handleToggle("vault")}
          className={cn(
            "relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors min-w-[88px] justify-center",
            mode === "vault"
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Lock className="h-4 w-4" />
          <span>Vault</span>
        </button>
      </div>

      {/* Ghost to Vault Warning Modal */}
      <AlertDialog open={showGhostToVaultModal} onOpenChange={setShowGhostToVaultModal}>
        <AlertDialogContent className="bg-card border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-foreground" />
              {t('modeToggle.toVault.title')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-muted-foreground">
                <p>{t('modeToggle.toVault.description1')}</p>
                <p>{t('modeToggle.toVault.description2')}</p>
                <p className="text-foreground">{t('modeToggle.toVault.confirm')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('modeToggle.toVault.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchToVault}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('modeToggle.toVault.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vault to Ghost Info Modal */}
      <AlertDialog open={showVaultToGhostModal} onOpenChange={setShowVaultToGhostModal}>
        <AlertDialogContent className="bg-card border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Ghost className="h-5 w-5 text-foreground" />
              {t('modeToggle.toGhost.title')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-muted-foreground">
                <p>{t('modeToggle.toGhost.description')}</p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>{t('modeToggle.toGhost.feature1')}</li>
                  <li>{t('modeToggle.toGhost.feature2')}</li>
                  <li>{t('modeToggle.toGhost.feature3')}</li>
                </ul>
                <p className="font-medium text-foreground">{t('modeToggle.toGhost.confirm')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchToGhost}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('modeToggle.toGhost.action')}
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
