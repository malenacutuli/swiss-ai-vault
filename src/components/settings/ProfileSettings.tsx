// src/components/settings/ProfileSettings.tsx
import React, { useState } from 'react';
import { User, Mail, Camera, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUserSettings } from '@/hooks/useUserSettings';

export function ProfileSettings() {
  const { profile, isLoading, isSaving, updateProfile } = useUserSettings();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile({ full_name: fullName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#1D4E5F]" />
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800',
    pro: 'bg-[#1D4E5F] text-white',
    enterprise: 'bg-purple-100 text-purple-800'
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your account details and public profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <Button variant="outline" size="sm">
              <Camera className="w-4 h-4 mr-2" />
              Change Avatar
            </Button>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input value={profile?.email || ''} disabled className="bg-gray-50" />
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          {/* Subscription */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
            <div>
              <p className="font-medium">Subscription</p>
              <p className="text-sm text-gray-500">
                {profile?.credits || 0} credits remaining
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={tierColors[profile?.subscription_tier || 'free']}>
                {profile?.subscription_tier || 'free'}
              </Badge>
              {profile?.subscription_tier === 'free' && (
                <Button size="sm" className="bg-[#1D4E5F] hover:bg-[#163d4d]">
                  Upgrade
                </Button>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#1D4E5F] hover:bg-[#163d4d]"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : null}
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Member Since</p>
                <p className="text-sm text-gray-500">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Account ID</p>
                <p className="text-sm text-gray-500 font-mono">
                  {profile?.id?.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
