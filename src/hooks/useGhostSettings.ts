import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GhostSettings {
  // General
  mature_filter_enabled: boolean;
  start_temporary: boolean;
  show_message_date: boolean;
  enter_submits: boolean;
  arrow_key_nav: boolean;
  enter_after_edit: 'regenerate' | 'fork';
  
  // Privacy
  show_external_link_warning: boolean;
  disable_telemetry: boolean;
  hide_personal_info: boolean;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  accent_color: 'swiss-navy' | 'sapphire' | 'burgundy' | 'teal';
  
  // Text settings
  web_enabled: boolean;
  url_scraping: boolean;
  system_prompt: string | null;
  disable_system_prompt: boolean;
  default_temperature: number;
  default_top_p: number;
  
  // Voice
  voice_read_responses: boolean;
  voice_language: string;
  voice_id: string;
  voice_speed: number;
  
  // Image settings
  image_aspect_ratio: string;
  image_hide_watermark: boolean;
  image_enhance_prompts: boolean;
  image_format: string;
  image_embed_exif: boolean;
}

const DEFAULT_SETTINGS: GhostSettings = {
  mature_filter_enabled: true,
  start_temporary: false,
  show_message_date: true,
  enter_submits: true,
  arrow_key_nav: false,
  enter_after_edit: 'regenerate',
  show_external_link_warning: true,
  disable_telemetry: false,
  hide_personal_info: false,
  theme: 'dark',
  accent_color: 'swiss-navy',
  web_enabled: true,
  url_scraping: true,
  system_prompt: null,
  disable_system_prompt: false,
  default_temperature: 0.7,
  default_top_p: 0.9,
  voice_read_responses: false,
  voice_language: 'en',
  voice_id: 'alloy',
  voice_speed: 1.0,
  image_aspect_ratio: '1:1',
  image_hide_watermark: false,
  image_enhance_prompts: true,
  image_format: 'png',
  image_embed_exif: false,
};

export function useGhostSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GhostSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage first, then sync with database
  useEffect(() => {
    const loadSettings = async () => {
      // Check localStorage first for fast access
      const cached = localStorage.getItem('ghost-settings');
      if (cached) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(cached) });
        } catch {
          // Invalid cache, ignore
        }
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('ghost_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[useGhostSettings] Load error:', error);
        }

        if (data) {
          const loadedSettings: GhostSettings = {
            mature_filter_enabled: data.mature_filter_enabled ?? DEFAULT_SETTINGS.mature_filter_enabled,
            start_temporary: data.start_temporary ?? DEFAULT_SETTINGS.start_temporary,
            show_message_date: data.show_message_date ?? DEFAULT_SETTINGS.show_message_date,
            enter_submits: data.enter_submits ?? DEFAULT_SETTINGS.enter_submits,
            arrow_key_nav: data.arrow_key_nav ?? DEFAULT_SETTINGS.arrow_key_nav,
            enter_after_edit: (data.enter_after_edit as 'regenerate' | 'fork') ?? DEFAULT_SETTINGS.enter_after_edit,
            show_external_link_warning: data.show_external_link_warning ?? DEFAULT_SETTINGS.show_external_link_warning,
            disable_telemetry: data.disable_telemetry ?? DEFAULT_SETTINGS.disable_telemetry,
            hide_personal_info: data.hide_personal_info ?? DEFAULT_SETTINGS.hide_personal_info,
            theme: (data.theme as 'light' | 'dark' | 'system') ?? DEFAULT_SETTINGS.theme,
            accent_color: (data.accent_color as GhostSettings['accent_color']) ?? DEFAULT_SETTINGS.accent_color,
            web_enabled: data.web_enabled ?? DEFAULT_SETTINGS.web_enabled,
            url_scraping: data.url_scraping ?? DEFAULT_SETTINGS.url_scraping,
            system_prompt: data.system_prompt ?? DEFAULT_SETTINGS.system_prompt,
            disable_system_prompt: data.disable_system_prompt ?? DEFAULT_SETTINGS.disable_system_prompt,
            default_temperature: data.default_temperature ?? DEFAULT_SETTINGS.default_temperature,
            default_top_p: data.default_top_p ?? DEFAULT_SETTINGS.default_top_p,
            voice_read_responses: data.voice_read_responses ?? DEFAULT_SETTINGS.voice_read_responses,
            voice_language: data.voice_language ?? DEFAULT_SETTINGS.voice_language,
            voice_id: data.voice_id ?? DEFAULT_SETTINGS.voice_id,
            voice_speed: data.voice_speed ?? DEFAULT_SETTINGS.voice_speed,
            image_aspect_ratio: data.image_aspect_ratio ?? DEFAULT_SETTINGS.image_aspect_ratio,
            image_hide_watermark: data.image_hide_watermark ?? DEFAULT_SETTINGS.image_hide_watermark,
            image_enhance_prompts: data.image_enhance_prompts ?? DEFAULT_SETTINGS.image_enhance_prompts,
            image_format: data.image_format ?? DEFAULT_SETTINGS.image_format,
            image_embed_exif: data.image_embed_exif ?? DEFAULT_SETTINGS.image_embed_exif,
          };
          setSettings(loadedSettings);
          localStorage.setItem('ghost-settings', JSON.stringify(loadedSettings));
        }
      } catch (error) {
        console.error('[useGhostSettings] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const updateSettings = useCallback(async (updates: Partial<GhostSettings>) => {
    const newSettings = { ...settings, ...updates };
    
    // Optimistic update
    setSettings(newSettings);
    localStorage.setItem('ghost-settings', JSON.stringify(newSettings));

    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('ghost_settings')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error) {
      console.error('[useGhostSettings] Save error:', error);
      // Rollback on error
      setSettings(settings);
      localStorage.setItem('ghost-settings', JSON.stringify(settings));
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [user, settings]);

  const resetToDefaults = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('ghost-settings', JSON.stringify(DEFAULT_SETTINGS));

    if (!user) return;

    try {
      await supabase
        .from('ghost_settings')
        .upsert({
          user_id: user.id,
          ...DEFAULT_SETTINGS,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('[useGhostSettings] Reset error:', error);
    }
  }, [user]);

  return {
    settings,
    updateSettings,
    resetToDefaults,
    isLoading,
    isSaving,
  };
}
