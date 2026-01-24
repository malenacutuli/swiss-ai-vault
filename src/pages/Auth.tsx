import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, Shield, Cloud, Cpu } from '@/icons';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

// Google icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Intent-aware benefits
const ghostBenefits = [
  { icon: Shield, text: 'Zero data retention' },
  { icon: Lock, text: 'Swiss-hosted AI models' },
  { icon: Eye, text: 'Complete privacy' },
];

const vaultBenefits = [
  { icon: Lock, text: 'End-to-end encryption' },
  { icon: Cloud, text: 'Sync across devices' },
  { icon: Cpu, text: 'Train custom AI models' },
];

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const { t } = useTranslation();
  
  // URL parameter detection
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent') as 'ghost' | 'vault' | null;
  const planFromUrl = searchParams.get('plan'); // Capture plan param for checkout
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Password reset form
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [isOAuthLoading, setIsOAuthLoading] = useState<'google' | null>(null);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || null;
  
  // Intent-aware content
  const benefits = intent === 'vault' ? vaultBenefits : ghostBenefits;
  const pageTitle = intent === 'vault' 
    ? 'Access Vault Chat & Labs' 
    : 'Welcome to Swiss BrAIn';
  const pageSubtitle = intent === 'vault'
    ? 'End-to-end encrypted AI with custom model training'
    : 'Private AI chat with Swiss data protection';

  // Post-login routing function
  const handlePostLoginRoute = async (userId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)('get_user_tier', { p_user_id: userId });
      const tier = data?.[0]?.tier || 'ghost_free';
      
      // Priority 1: Return to original protected route
      if (from && !['/auth', '/', '/auth?intent=ghost'].includes(from)) {
        navigate(from, { replace: true });
        return;
      }
      
      // Priority 2: Check for pending checkout (from URL plan param or localStorage)
      const pendingCheckout = localStorage.getItem('pendingCheckout');
      const pendingPlan = planFromUrl || pendingCheckout;
      
      if (pendingPlan && pendingPlan !== 'pro') {
        // Handle specific tier checkout (ghost_pro, vault_pro, etc.)
        localStorage.removeItem('pendingCheckout');
        try {
          const { data: checkoutData, error } = await supabase.functions.invoke('create-pro-checkout', {
            body: { tier: pendingPlan, billing_period: 'monthly' }
          });
          if (!error && checkoutData?.url) {
            window.open(checkoutData.url, '_blank');
          }
        } catch (err) {
          console.error('Checkout error:', err);
        }
        navigate('/ghost/chat', { replace: true });
        return;
      }
      
      if (pendingCheckout === 'pro') {
        localStorage.removeItem('pendingCheckout');
        try {
          const { data: checkoutData, error } = await supabase.functions.invoke('create-pro-checkout');
          if (!error && checkoutData?.url) {
            window.open(checkoutData.url, '_blank');
          }
        } catch (err) {
          console.error('Checkout error:', err);
        }
        navigate('/ghost/chat', { replace: true });
        return;
      }
      
      // Priority 3: Route based on tier
      if (['premium', 'enterprise'].includes(tier)) {
        navigate('/labs', { replace: true });
      } else {
        navigate('/ghost/chat', { replace: true });
      }
    } catch (error) {
      console.error('Error determining post-login route:', error);
      navigate('/ghost/chat', { replace: true });
    }
  };

  // Detect password reset flow from email link
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isReset = params.get('reset') === 'true';
    
    if (isReset) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPasswordForm(true);
        }
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setShowResetPasswordForm(true);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [location.search]);

  const handleOAuthLogin = async (provider: 'google') => {
    setIsOAuthLoading(provider);
    // Always redirect to our dedicated callback route so the code exchange is handled consistently.
    // (The /auth page is a UI screen and shouldn't be the OAuth landing URL.)
    const redirectUrl = `${window.location.origin}/auth/callback${intent ? `?intent=${intent}` : ''}`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });
    
    if (error) {
      toast({
        title: t('auth.oauthError'),
        description: error.message,
        variant: 'destructive',
      });
      setIsOAuthLoading(null);
    }
  };

  // Handle password update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmNewPassword) {
      toast({
        title: t('common.error'),
        description: t('auth.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordsNoMatch'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordMinLength'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.passwordUpdated'),
        description: t('auth.passwordUpdatedDesc'),
      });
      setShowResetPasswordForm(false);
      setNewPassword('');
      setConfirmNewPassword('');
      navigate('/ghost/chat', { replace: true });
    }
  };

  // Redirect if already logged in (but not during password reset)
  useEffect(() => {
    if (user && !showResetPasswordForm) {
      handlePostLoginRoute(user.id);
    }
  }, [user, showResetPasswordForm]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast({
        title: t('common.error'),
        description: t('auth.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: t('auth.loginFailed'),
        description: error.message === 'Invalid login credentials' 
          ? t('auth.invalidCredentials')
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.loginSuccess'),
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupPassword || !signupConfirmPassword) {
      toast({
        title: t('common.error'),
        description: t('auth.fillRequiredFields'),
        variant: 'destructive',
      });
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordsNoMatch'),
        variant: 'destructive',
      });
      return;
    }

    if (signupPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordMinLength'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, fullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: t('auth.accountExists'),
          description: t('auth.accountExistsDesc'),
          variant: 'destructive',
        });
        setActiveTab('login');
        setLoginEmail(signupEmail);
      } else {
        toast({
          title: t('auth.signupFailed'),
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: t('auth.accountCreated'),
        description: t('auth.accountCreatedDesc'),
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast({
        title: t('common.error'),
        description: t('auth.fillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('auth.resetEmailSent'),
        description: t('auth.resetEmailSentDesc'),
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to={intent === 'ghost' ? '/ghost/chat' : '/'} className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{intent === 'ghost' ? 'Back to Ghost Chat' : t('auth.backToHome')}</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <SwissFlag className="h-8" />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <SwissFlag className="h-12" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{pageTitle}</h1>
            <p className="text-muted-foreground text-sm">
              {pageSubtitle}
            </p>
          </div>

          {/* Benefits display */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border mb-6">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2">
                  <benefit.icon className="h-4 w-4 text-primary" />
                  {benefit.text}
                </li>
              ))}
            </ul>
          </div>

          <Card className="border-border/50 shadow-elevated">
            {showResetPasswordForm ? (
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-semibold">{t('auth.setNewPassword')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('auth.setNewPasswordDesc')}
                    </p>
                  </div>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">{t('auth.confirmNewPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="confirm-new-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        t('auth.updatePassword')
                      )}
                    </Button>
                  </form>
                </div>
              </CardContent>
            ) : showForgotPassword ? (
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-semibold">{t('auth.resetPassword')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('auth.enterEmailForReset')}
                    </p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">{t('auth.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        t('auth.sendResetLink')
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      {t('auth.backToLogin')}
                    </Button>
                  </form>
                </div>
              </CardContent>
            ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t('auth.logIn')}</TabsTrigger>
                  <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                {/* OAuth Buttons */}
                <div className="space-y-3 mb-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuthLogin('google')}
                    disabled={isOAuthLoading !== null || isLoading}
                  >
                    {isOAuthLoading === 'google' ? (
                      <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">{t('auth.continueWithGoogle')}</span>
                  </Button>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t('auth.orContinueWithEmail')}</span>
                  </div>
                </div>

                {/* Login Tab */}
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">{t('auth.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordEmail(loginEmail);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        t('auth.logIn')
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Signup Tab */}
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">{t('auth.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="full-name"
                          type="text"
                          placeholder={t('auth.fullNamePlaceholder')}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10"
                          autoComplete="name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{t('auth.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{t('auth.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="pl-10"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        t('auth.createAccount')
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Data residency notice */}
                <div className="mt-6 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <SwissFlag className="w-4 h-4" />
                    <span>{t('auth.dataResidency')}</span>
                  </div>
                </div>
              </CardContent>
            </Tabs>
            )}
          </Card>

          {/* Continue without account link for ghost intent */}
          {intent === 'ghost' && (
            <div className="text-center mt-4">
              <Link
                to="/ghost/chat"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Continue without account
              </Link>
            </div>
          )}

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t('auth.termsPrefix')}{' '}
            <Link to="/terms-of-service" className="text-primary hover:underline">{t('auth.termsOfService')}</Link>
            {' '}{t('common.and')}{' '}
            <Link to="/privacy-policy" className="text-primary hover:underline">{t('auth.privacyPolicy')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
