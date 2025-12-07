import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Building2 } from "lucide-react";
import { useAcceptInvitation } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { acceptInvitation, loading } = useAcceptInvitation();
  const { user, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [invitation, setInvitation] = useState<{
    organization_name?: string;
    role?: string;
    email?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const checkInvitation = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Invalid invitation link");
        return;
      }

      // Fetch invitation details
      const { data, error } = await supabase
        .from("organization_invitations")
        .select(`
          email,
          role,
          expires_at,
          organizations!inner(name)
        `)
        .eq("token", token)
        .single();

      if (error || !data) {
        setStatus("error");
        setErrorMessage("Invitation not found or has expired");
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setStatus("error");
        setErrorMessage("This invitation has expired");
        return;
      }

      setInvitation({
        organization_name: (data.organizations as any)?.name,
        role: data.role,
        email: data.email,
      });
      setStatus("ready");
    };

    checkInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    // Check if user is logged in with matching email
    if (!user) {
      // Redirect to login with return URL
      navigate(`/auth?redirect=/accept-invitation?token=${token}`);
      return;
    }

    if (invitation?.email && user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setStatus("error");
      setErrorMessage(`This invitation was sent to ${invitation.email}. Please sign in with that email address.`);
      return;
    }

    const result = await acceptInvitation(token);
    if (result) {
      setStatus("success");
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } else {
      setStatus("error");
      setErrorMessage("Failed to accept invitation. Please try again.");
    }
  };

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Unable to Accept Invitation</h2>
            <p className="mt-2 text-muted-foreground">{errorMessage}</p>
            <Button className="mt-6" onClick={() => navigate("/")}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Welcome to the Team!</h2>
            <p className="mt-2 text-muted-foreground">
              You've successfully joined {invitation?.organization_name}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium text-foreground">{invitation?.organization_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium text-foreground capitalize">{invitation?.role}</span>
            </div>
            {invitation?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{invitation.email}</span>
              </div>
            )}
          </div>

          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Sign in or create an account to accept this invitation.
              </p>
              <Button className="w-full" onClick={handleAccept}>
                Continue to Sign In
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
              <Button className="w-full" onClick={handleAccept} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept Invitation
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            By accepting, you agree to the organization's terms and policies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
