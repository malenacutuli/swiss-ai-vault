import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Building2, Loader2, Check, X, User } from '@/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function FirstTimeOrganizationModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const checkOrganizationMembership = useCallback(async () => {
    if (!user) {
      setCheckingMembership(false);
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking memberships:', error);
        setCheckingMembership(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setOpen(true);
      }
    } catch (err) {
      console.error('Error checking memberships:', err);
    } finally {
      setCheckingMembership(false);
    }
  }, [user]);

  useEffect(() => {
    checkOrganizationMembership();
  }, [checkOrganizationMembership]);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  };

  const validateSlug = (slug: string): boolean => {
    return /^[a-z0-9-]{3,30}$/.test(slug);
  };

  const checkSlugAvailability = useCallback(async (slugToCheck: string) => {
    if (!slugToCheck || slugToCheck.length < 3 || !validateSlug(slugToCheck)) {
      setSlugAvailable(null);
      return;
    }

    setSlugChecking(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slugToCheck)
        .maybeSingle();

      if (error) {
        console.error('Error checking slug:', error);
        setSlugAvailable(null);
        return;
      }

      setSlugAvailable(!data);
    } catch (err) {
      console.error('Error checking slug:', err);
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  }, []);

  useEffect(() => {
    if (orgName) {
      const newSlug = generateSlug(orgName);
      setSlug(newSlug);
    }
  }, [orgName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (slug && slug.length >= 3) {
        checkSlugAvailability(slug);
      } else {
        setSlugAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, checkSlugAvailability]);

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAvatarChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    if (!validateSlug(slug)) {
      setError('Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only');
      return;
    }

    if (slugAvailable === false) {
      setError('This slug is already taken');
      return;
    }

    setLoading(true);

    try {
      // Upload avatar if provided
      let avatarUrl: string | null = null;
      if (avatar && user) {
        const fileExt = avatar.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatar);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Create organization using RPC
      const { data, error: rpcError } = await supabase.rpc('create_organization_with_owner', {
        p_name: orgName.trim(),
        p_slug: slug,
        p_avatar_url: avatarUrl
      });

      if (rpcError) {
        if (rpcError.message.includes('duplicate') || rpcError.message.includes('unique')) {
          setError('This slug is already taken. Please choose another.');
        } else {
          setError(rpcError.message);
        }
        return;
      }

      toast.success('Organization created successfully!');
      setOpen(false);
      
      // Refresh to load org context
      window.location.reload();
    } catch (err) {
      console.error('Error creating organization:', err);
      setError('Failed to create organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createPersonalWorkspace = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error('No user');

      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Workspace';
      const baseSlug = generateSlug(user.email?.split('@')[0] || `user-${user.id.slice(0, 8)}`);
      
      // Ensure slug is unique by adding random suffix if needed
      let finalSlug = baseSlug;
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', baseSlug)
        .maybeSingle();
      
      if (existing) {
        finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const { error: rpcError } = await supabase.rpc('create_organization_with_owner', {
        p_name: `${name}'s Workspace`,
        p_slug: finalSlug,
        p_avatar_url: null
      });

      if (rpcError) throw rpcError;

      toast.success('Personal workspace created successfully!');
      setOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Error creating personal workspace:', err);
      setError('Failed to create workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingMembership || !user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]" 
        hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Create Your Organization</DialogTitle>
          <DialogDescription>
            Set up your organization to start collaborating with your team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="org-name" className="text-foreground">
              Organization Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Inc"
              className="bg-secondary border-border"
              required
              disabled={loading}
            />
          </div>

          {/* URL Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-foreground">
              URL Slug <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">swissvault.ai/</span>
              <div className="relative flex-1">
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  placeholder="acme-inc"
                  className={cn(
                    "bg-secondary border-border pr-8",
                    slugAvailable === false && "border-destructive focus-visible:ring-destructive",
                    slugAvailable === true && "border-green-500 focus-visible:ring-green-500"
                  )}
                  required
                  disabled={loading}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {slugChecking && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!slugChecking && slugAvailable === true && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!slugChecking && slugAvailable === false && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            </div>
            {slug && slug.length < 3 && (
              <p className="text-xs text-muted-foreground">
                Slug must be at least 3 characters
              </p>
            )}
            {slugAvailable === false && (
              <p className="text-xs text-destructive">
                This slug is already taken
              </p>
            )}
            {slugAvailable === true && (
              <p className="text-xs text-green-500">
                This slug is available!
              </p>
            )}
          </div>

          {/* Avatar Upload */}
          <div className="space-y-2">
            <Label className="text-foreground">Organization Avatar (Optional)</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/50",
                avatarPreview && "border-solid"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('avatar-upload')?.click()}
            >
              {avatarPreview ? (
                <div className="flex items-center justify-center gap-4">
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{avatar?.name}</p>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvatar(null);
                        setAvatarPreview(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Drag and drop or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 5MB
                  </p>
                </>
              )}
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || slugAvailable === false || !orgName.trim() || !validateSlug(slug)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Building2 className="mr-2 h-4 w-4" />
                Create Organization
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Personal Workspace Option */}
          <Button
            type="button"
            variant="outline"
            onClick={createPersonalWorkspace}
            disabled={loading}
            className="w-full"
          >
            <User className="mr-2 h-4 w-4" />
            Create Personal Workspace Instead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
