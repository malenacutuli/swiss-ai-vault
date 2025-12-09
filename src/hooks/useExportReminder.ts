/**
 * Export Reminder Hook for ZeroTrace Chats
 * 
 * Tracks ZeroTrace chat activity and prompts users to export backups:
 * - After 20+ messages in a conversation (once per session)
 * - When closing tab with unsaved ZeroTrace chats
 * - Weekly reminder if any ZeroTrace chats exist
 */

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { localChatStorage } from '@/lib/storage/local-chat-storage';

const MESSAGE_THRESHOLD = 20;
const WEEKLY_REMINDER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_EXPORT_KEY = 'zerotrace_last_export';
const REMINDED_CONVOS_KEY = 'zerotrace_reminded_conversations';
const WEEKLY_REMINDER_SHOWN_KEY = 'zerotrace_weekly_reminder_shown';

interface UseExportReminderOptions {
  isZeroTrace: boolean;
  conversationId: string | null;
  messageCount: number;
  onExportRequest?: (conversationId: string) => void;
}

export function useExportReminder({
  isZeroTrace,
  conversationId,
  messageCount,
  onExportRequest,
}: UseExportReminderOptions) {
  const hasShownUnloadWarning = useRef(false);

  // Get reminded conversations from session storage
  const getRemindedConversations = useCallback((): Set<string> => {
    try {
      const stored = sessionStorage.getItem(REMINDED_CONVOS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  // Mark conversation as reminded in session storage
  const markAsReminded = useCallback((convId: string) => {
    try {
      const reminded = getRemindedConversations();
      reminded.add(convId);
      sessionStorage.setItem(REMINDED_CONVOS_KEY, JSON.stringify([...reminded]));
    } catch (e) {
      console.error('[ExportReminder] Failed to mark as reminded:', e);
    }
  }, [getRemindedConversations]);

  // Record that an export was performed
  const recordExport = useCallback(() => {
    try {
      localStorage.setItem(LAST_EXPORT_KEY, Date.now().toString());
    } catch (e) {
      console.error('[ExportReminder] Failed to record export:', e);
    }
  }, []);

  // Check if weekly reminder is needed
  const needsWeeklyReminder = useCallback((): boolean => {
    try {
      const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
      const weeklyShown = sessionStorage.getItem(WEEKLY_REMINDER_SHOWN_KEY);
      
      // Don't show if already shown this session
      if (weeklyShown) return false;
      
      // If never exported, show reminder
      if (!lastExport) return true;
      
      const lastExportTime = parseInt(lastExport, 10);
      return Date.now() - lastExportTime > WEEKLY_REMINDER_MS;
    } catch {
      return false;
    }
  }, []);

  // Mark weekly reminder as shown
  const markWeeklyReminderShown = useCallback(() => {
    try {
      sessionStorage.setItem(WEEKLY_REMINDER_SHOWN_KEY, 'true');
    } catch (e) {
      console.error('[ExportReminder] Failed to mark weekly reminder:', e);
    }
  }, []);

  // Show message count reminder toast
  const showMessageCountReminder = useCallback((convId: string, count: number) => {
    toast(`You have ${count} messages in this ZeroTrace chat`, {
      description: 'Would you like to export a backup?',
      duration: 10000,
      action: {
        label: 'Export Now',
        onClick: () => {
          onExportRequest?.(convId);
        },
      },
      cancel: {
        label: 'Later',
        onClick: () => {
          // Just dismiss
        },
      },
    });
    markAsReminded(convId);
  }, [onExportRequest, markAsReminded]);

  // Show weekly reminder toast
  const showWeeklyReminder = useCallback(async () => {
    try {
      const conversations = await localChatStorage.listConversations();
      if (conversations.length === 0) return;

      const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);
      
      toast(`You have ${conversations.length} ZeroTrace chat(s) with ${totalMessages} messages`, {
        description: 'These exist only on this device. Consider exporting a backup.',
        duration: 15000,
        action: {
          label: 'View Chats',
          onClick: () => {
            window.location.href = '/vault-chat';
          },
        },
      });
      
      markWeeklyReminderShown();
    } catch (e) {
      console.error('[ExportReminder] Failed to check for weekly reminder:', e);
    }
  }, [markWeeklyReminderShown]);

  // Check message count threshold
  useEffect(() => {
    if (!isZeroTrace || !conversationId || messageCount < MESSAGE_THRESHOLD) {
      return;
    }

    const reminded = getRemindedConversations();
    if (reminded.has(conversationId)) {
      return; // Already reminded this session
    }

    // Show reminder after a short delay to not interrupt flow
    const timer = setTimeout(() => {
      showMessageCountReminder(conversationId, messageCount);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isZeroTrace, conversationId, messageCount, getRemindedConversations, showMessageCountReminder]);

  // Weekly reminder check on mount
  useEffect(() => {
    if (!isZeroTrace) return;

    if (needsWeeklyReminder()) {
      // Delay to not show immediately on page load
      const timer = setTimeout(() => {
        showWeeklyReminder();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isZeroTrace, needsWeeklyReminder, showWeeklyReminder]);

  // Beforeunload handler
  useEffect(() => {
    if (!isZeroTrace) return;

    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      try {
        const conversations = await localChatStorage.listConversations();
        const hasUnsavedChats = conversations.length > 0 && conversations.some(c => (c.message_count || 0) > 0);

        if (hasUnsavedChats && !hasShownUnloadWarning.current) {
          event.preventDefault();
          // Modern browsers require returnValue to be set
          event.returnValue = 'You have ZeroTrace chats that exist only on this device. Are you sure you want to leave?';
          return event.returnValue;
        }
      } catch (e) {
        console.error('[ExportReminder] Error in beforeunload:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isZeroTrace]);

  return {
    recordExport,
    showMessageCountReminder,
    showWeeklyReminder,
  };
}
