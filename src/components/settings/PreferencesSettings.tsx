// src/components/settings/PreferencesSettings.tsx
import React from 'react';
import { Settings, Palette, Bot, Shield, Bell, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useUserSettings } from '@/hooks/useUserSettings';

export function PreferencesSettings() {
  const { profile, isSaving, updatePreferences } = useUserSettings();
  const [saved, setSaved] = React.useState(false);

  const preferences = profile?.preferences;

  const handleUpdate = async (key: string, value: any) => {
    try {
      await updatePreferences({ [key]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update preference:', err);
    }
  };

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-sm text-gray-500">Select your preferred theme</p>
            </div>
            <Select
              value={preferences.theme}
              onValueChange={(v) => handleUpdate('theme', v)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Language</Label>
              <p className="text-sm text-gray-500">Interface language</p>
            </div>
            <Select
              value={preferences.language}
              onValueChange={(v) => handleUpdate('language', v)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Model</Label>
              <p className="text-sm text-gray-500">Model used for new conversations</p>
            </div>
            <Select
              value={preferences.default_model}
              onValueChange={(v) => handleUpdate('default_model', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                <SelectItem value="gemini-2.0-pro">Gemini 2.0 Pro</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="claude-3-5-haiku">Claude 3.5 Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature: {preferences.temperature}</Label>
              <span className="text-sm text-gray-500">
                {preferences.temperature < 0.3 ? 'Precise' :
                 preferences.temperature > 0.7 ? 'Creative' : 'Balanced'}
              </span>
            </div>
            <Slider
              value={[preferences.temperature]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={([v]) => handleUpdate('temperature', v)}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy
          </CardTitle>
          <CardDescription>
            Control how your data is stored and processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Privacy Mode</Label>
              <p className="text-sm text-gray-500">Level of data protection</p>
            </div>
            <Select
              value={preferences.privacy_mode}
              onValueChange={(v) => handleUpdate('privacy_mode', v)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="vault">Vault</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 border">
            <p className="text-sm">
              {preferences.privacy_mode === 'ghost' && (
                <span className="text-purple-700">
                  <strong>Ghost Mode:</strong> Zero data retention. Conversations are encrypted locally and never stored on our servers.
                </span>
              )}
              {preferences.privacy_mode === 'vault' && (
                <span className="text-blue-700">
                  <strong>Vault Mode:</strong> End-to-end encryption with RAG. Your data is encrypted at rest and in transit.
                </span>
              )}
              {preferences.privacy_mode === 'standard' && (
                <span className="text-gray-700">
                  <strong>Standard Mode:</strong> Data stored securely in Swiss data centers with enterprise-grade protection.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Data Retention</Label>
              <p className="text-sm text-gray-500">How long to keep your data</p>
            </div>
            <Select
              value={String(preferences.data_retention_days)}
              onValueChange={(v) => handleUpdate('data_retention_days', parseInt(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="0">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500">Receive updates via email</p>
            </div>
            <Switch
              checked={preferences.notifications_email}
              onCheckedChange={(v) => handleUpdate('notifications_email', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Push Notifications</Label>
              <p className="text-sm text-gray-500">Browser notifications</p>
            </div>
            <Switch
              checked={preferences.notifications_push}
              onCheckedChange={(v) => handleUpdate('notifications_push', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-save indicator */}
      {saved && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg shadow-lg">
          <Check className="w-4 h-4" />
          Preferences saved
        </div>
      )}
    </div>
  );
}
