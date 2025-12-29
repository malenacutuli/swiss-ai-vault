import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft } from '@/icons';
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

// GitHub icon component
const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const { t } = useTranslation();
  
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
  
  const [isOAuthLoading, setIsOAuthLoading] = useState<'google' | 'github' | null>(null);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || '/dashboard';

  // Detect password reset flow from email link
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isReset = params.get('reset') === 'true';
    
    if (isReset) {
      // Listen for PASSWORD_RECOVERY event from Supabase
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetPasswordForm(true);
        }
      });

      // Also check if we're already in a recovery session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setShowResetPasswordForm(true);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [location.search]);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsOAuthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
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
      // Clear URL params and redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  };

  // Redirect if already logged in (but not during password reset)
  useEffect(() => {
    const handleRedirectAfterLogin = async () => {
      if (user && !showResetPasswordForm) {
        const pendingCheckout = localStorage.getItem('pendingCheckout');
        if (pendingCheckout === 'pro') {
          localStorage.removeItem('pendingCheckout');
          // Trigger Pro checkout after login
          try {
            const { data, error } = await supabase.functions.invoke('create-pro-checkout');
            if (!error && data?.url) {
              window.open(data.url, '_blank');
            }
          } catch (err) {
            console.error('Checkout error:', err);
          }
          navigate('/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    };
    handleRedirectAfterLogin();
  }, [user, navigate, from, showResetPasswordForm]);

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
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{t('auth.backToHome')}</span>
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
            <h1 className="text-2xl font-bold mb-2">{t('auth.welcomeTitle')}</h1>
            <p className="text-muted-foreground text-sm">
              {t('auth.welcomeSubtitle')}
            </p>
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

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            {t('auth.termsPrefix')}{' '}
            <a href="#" className="text-primary hover:underline">{t('auth.termsOfService')}</a>
            {' '}{t('common.and')}{' '}
            <a href="/privacy-policy" className="text-primary hover:underline">{t('auth.privacyPolicy')}</a>
          </p>
        </div>
      </div>
    </div>
  );
}