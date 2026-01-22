import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { EncryptionProvider } from "@/contexts/EncryptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { FirstTimeOrganizationModal } from "@/components/FirstTimeOrganizationModal";
import { LegacyRedirect } from "@/components/LegacyRedirect";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { chatEncryption } from "@/lib/encryption";

// Lazy load new dashboard components
const AdminDashboardNew = lazy(() => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SettingsPageNew = lazy(() => import('@/components/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AgentDashboardNew = lazy(() => import('@/components/agents/AgentDashboard').then(m => ({ default: m.AgentDashboard })));
const IntegrationsPageNew = lazy(() => import('@/components/integrations/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin w-8 h-8 border-2 border-[#1D4E5F] border-t-transparent rounded-full" />
  </div>
);

// Layouts
import { ChatLayout } from "@/layouts/ChatLayout";
import { LabsLayout } from "@/layouts/LabsLayout";
import { MarketingLayout } from "@/layouts/MarketingLayout";
import { AdminLayout as AdminLayoutComponent } from "@/layouts/AdminLayout";

// Admin Pages
import AdminDashboardPage from "@/pages/admin/AdminDashboard";
import UsersManagementPage from "@/pages/admin/UsersManagement";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogs";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Datasets from "./pages/Datasets";
import DatasetDetail from "./pages/DatasetDetail";
import Finetuning from "./pages/Finetuning";
import FinetuningJobDetail from "./pages/FinetuningJobDetail";
import Templates from "./pages/Templates";
import Evaluations from "./pages/Evaluations";
import EvaluationDetail from "./pages/EvaluationDetail";
import Models from "./pages/Models";
import ModelDetail from "./pages/ModelDetail";
import ModelsCatalog from "./pages/ModelsCatalog";
import Playground from "./pages/Playground";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Stats from "./pages/Stats";
import Traces from "./pages/Traces";
import Admin from "./pages/Admin";
import AuditLogs from "./pages/AuditLogs";
import Compliance from "./pages/Compliance";
import ApiDocs from "./pages/ApiDocs";
import OnPremisesDeployment from "./pages/OnPremisesDeployment";
import NotFound from "./pages/NotFound";
import DesignSystem from "./pages/DesignSystem";
import Billing from "./pages/Billing";
import AcceptInvitation from "./pages/AcceptInvitation";
import VaultChat from "./pages/VaultChat";
import { VaultChatGate } from "@/components/gates";
import VaultChatIntegrations from "./pages/VaultChatIntegrations";
import SecureChat from "./pages/SecureChat";
import GhostChat from "./pages/GhostChat";
import GhostPricing from "./pages/GhostPricing";
import GhostLibrary from "./pages/GhostLibrary";
import MemoryDashboard from "./pages/MemoryDashboard";
import MemoryProjectsPage from "./pages/MemoryProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ResearchDashboard from "./pages/ResearchDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import Contact from "./pages/Contact";
import DPA from "./pages/DPA";
import Security from "./pages/Security";
import Status from "./pages/Status";
import StatusPage from "./pages/StatusPage";
import LaunchPage from "./pages/LaunchPage";
import OAuthCallback from "./pages/OAuthCallback";
import AuthCallback from "./pages/auth/callback";
import VaultChatFeatures from "./pages/VaultChatFeatures";
import VaultLabsFeatures from "./pages/VaultLabsFeatures";
import APIPricing from "./pages/APIPricing";
import Agents from "./pages/Agents";
import AgentsStudio from "./pages/AgentsStudio";
import AgentsDev from "./pages/AgentsDev";
import AgentWorkspace from "./pages/AgentWorkspace";
import AgentBuilderPage from "./pages/AgentBuilder";
import SwissBrAInAgents from "./pages/SwissBrAInAgents";
import ManusHome from "./pages/ManusHome";
import ManusTaskExecution from "./pages/ManusTaskExecution";
import WorkspacesPage from "./pages/Workspaces";
import Studio from "./pages/Studio";
import AgentsV2Page from "./pages/agents-v2";
import Upgrade from "./pages/Upgrade";
import GhostFinance from "./pages/ghost/GhostFinance";
import GhostPatents from "./pages/ghost/GhostPatents";
import GhostLegal from "./pages/ghost/GhostLegal";
import GhostResearch from "./pages/ghost/GhostResearch";
import GhostSecurity from "./pages/ghost/GhostSecurity";
import GhostHealth from "./pages/ghost/GhostHealth";
import GhostTravel from "./pages/ghost/GhostTravel";
import GhostRealEstate from "./pages/ghost/GhostRealEstate";
import GhostArt from "./pages/ghost/GhostArt";
import GhostVentureCapital from "./pages/ghost/GhostVentureCapital";
import VaultHealth from "./pages/vault/VaultHealth";
import { OnboardingWizard } from "./components/onboarding";

const queryClient = new QueryClient();

const App = () => {
  // Initialize Vault Chat encryption on app start
  useEffect(() => {
    chatEncryption.initialize()
      .then(() => console.log('[Vault Chat] Encryption ready'))
      .catch((err) => console.error('[Vault Chat] Encryption init failed:', err));
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <EncryptionProvider>
                <FirstTimeOrganizationModal />
                <Routes>
                {/* Public routes - Marketing pages with MarketingLayout */}
                <Route path="/" element={<MarketingLayout><Index /></MarketingLayout>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/onboarding" element={<OnboardingWizard />} />
                <Route path="/docs/api" element={<MarketingLayout><ApiDocs /></MarketingLayout>} />
                <Route path="/docs/on-premises" element={<MarketingLayout><OnPremisesDeployment /></MarketingLayout>} />
                <Route path="/accept-invitation" element={<AcceptInvitation />} />
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="/design-system" element={<MarketingLayout><DesignSystem /></MarketingLayout>} />
                <Route path="/privacy-policy" element={<MarketingLayout><PrivacyPolicy /></MarketingLayout>} />
                <Route path="/terms-of-service" element={<MarketingLayout><TermsOfService /></MarketingLayout>} />
                <Route path="/about" element={<MarketingLayout><About /></MarketingLayout>} />
                <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />
                <Route path="/dpa" element={<MarketingLayout><DPA /></MarketingLayout>} />
                <Route path="/security" element={<MarketingLayout><Security /></MarketingLayout>} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/launch" element={<LaunchPage />} />
                <Route path="/features/vault-chat" element={<MarketingLayout><VaultChatFeatures /></MarketingLayout>} />
                <Route path="/features/vault-labs" element={<MarketingLayout><VaultLabsFeatures /></MarketingLayout>} />
                <Route path="/api-pricing" element={<MarketingLayout><APIPricing /></MarketingLayout>} />

                {/* Vault Chat routes (simple mode) - Pro tier required */}
                <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>}>
                  <Route index element={<VaultChatGate><VaultChat /></VaultChatGate>} />
                  <Route path=":conversationId" element={<VaultChatGate><VaultChat /></VaultChatGate>} />
                </Route>
                
                {/* Ghost Chat routes - NO AUTH REQUIRED */}
                <Route path="/ghost" element={<GhostChat />} />
                <Route path="/ghost/chat" element={<GhostChat />} />
                <Route path="/ghost/pricing" element={<GhostPricing />} />
                <Route path="/ghost/library" element={<ProtectedRoute><GhostLibrary /></ProtectedRoute>} />
                <Route path="/ghost/memory" element={<ProtectedRoute><MemoryDashboard /></ProtectedRoute>} />
                <Route path="/ghost/projects" element={<ProtectedRoute><MemoryProjectsPage /></ProtectedRoute>} />
                <Route path="/ghost/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
                <Route path="/ghost/research-library" element={<ProtectedRoute><ResearchDashboard /></ProtectedRoute>} />
                <Route path="/ghost/agents" element={<ProtectedRoute><ErrorBoundary><ManusHome /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/ghost/agents/task/:taskId" element={<ProtectedRoute><ErrorBoundary><AgentWorkspace /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/ghost/agents/studio" element={<ProtectedRoute><ErrorBoundary><AgentsStudio /></ErrorBoundary></ProtectedRoute>} />

                {/* Development route for testing Claude Code implementations */}
                <Route path="/agents-dev" element={<ProtectedRoute><ErrorBoundary><AgentsDev /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/workspace/:taskId" element={<ProtectedRoute><ErrorBoundary><AgentWorkspace /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/workspace" element={<ProtectedRoute><ErrorBoundary><AgentWorkspace /></ErrorBoundary></ProtectedRoute>} />

                {/* Top-level convenience routes */}
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <SettingsPageNew />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/agents" element={<ProtectedRoute><ErrorBoundary><ManusHome /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/task/:taskId" element={<ProtectedRoute><ErrorBoundary><ManusTaskExecution /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents/legacy" element={<ProtectedRoute><ErrorBoundary><SwissBrAInAgents /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents/old" element={<ProtectedRoute><ErrorBoundary><Agents /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents/dashboard" element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AgentDashboardNew />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/agents/studio" element={<ProtectedRoute><ErrorBoundary><AgentsStudio /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents/builder" element={<ProtectedRoute><ErrorBoundary><AgentBuilderPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><ErrorBoundary><Studio /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Swiss Agents V2 - Test Environment with Manus API */}
                <Route path="/agents-v2" element={<ProtectedRoute><ErrorBoundary><AgentsV2Page /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents-v2/task/:taskId" element={<ProtectedRoute><ErrorBoundary><AgentsV2Page /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/integrations" element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <IntegrationsPageNew />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/workspaces" element={<ProtectedRoute><ErrorBoundary><WorkspacesPage /></ErrorBoundary></ProtectedRoute>} />

                <Route path="/ghost/finance" element={<GhostFinance />} />
                <Route path="/ghost/patents" element={<GhostPatents />} />
                <Route path="/ghost/legal" element={<GhostLegal />} />
                <Route path="/ghost/research" element={<GhostResearch />} />
                <Route path="/ghost/security" element={<GhostSecurity />} />
                <Route path="/ghost/health" element={<GhostHealth />} />
                <Route path="/ghost/travel" element={<GhostTravel />} />
                <Route path="/ghost/realestate" element={<GhostRealEstate />} />
                <Route path="/ghost/art" element={<GhostArt />} />
                <Route path="/ghost/vc" element={<GhostVentureCapital />} />

                {/* Vault Health - Advanced Healthcare AI (Pro feature) */}
                <Route path="/vault/health" element={<ProtectedRoute><VaultHealth /></ProtectedRoute>} />

                {/* Ghost Auth routes - redirect to unified auth */}
                <Route path="/auth/ghost-signup" element={<Navigate to="/auth?intent=ghost" replace />} />

                {/* Legacy chat routes - redirect to new paths with toast */}
                <Route path="/vault-chat" element={<LegacyRedirect to="/chat" message="Vault Chat has moved to /chat" />} />
                <Route path="/vault-chat/:conversationId" element={<LegacyRedirect to="/chat" message="Vault Chat has moved to /chat" />} />
                <Route path="/secure-chat" element={<LegacyRedirect to="/chat" message="Secure Chat has moved to /chat" />} />
                <Route path="/secure-chat/:conversationId" element={<LegacyRedirect to="/chat" message="Secure Chat has moved to /chat" />} />

                {/* Vault Labs routes (full mode) */}
                <Route path="/labs" element={<ProtectedRoute><LabsLayout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="projects/:id" element={<ProjectDetail />} />
                  <Route path="datasets" element={<Datasets />} />
                  <Route path="datasets/:id" element={<DatasetDetail />} />
                  <Route path="finetuning" element={<Finetuning />} />
                  <Route path="finetuning/:id" element={<FinetuningJobDetail />} />
                  <Route path="templates" element={<Templates />} />
                  <Route path="evaluations" element={<Evaluations />} />
                  <Route path="evaluations/:id" element={<EvaluationDetail />} />
                  <Route path="models" element={<Models />} />
                  <Route path="models/:id" element={<ModelDetail />} />
                  <Route path="catalog" element={<ModelsCatalog />} />
                  <Route path="playground" element={<Playground />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="integrations" element={<VaultChatIntegrations />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="stats" element={<Stats />} />
                  <Route path="traces" element={<Traces />} />
                  <Route path="billing" element={<Billing />} />
                </Route>

                {/* Admin routes */}
                <Route path="/labs/admin" element={<AdminRoute><LabsLayout /></AdminRoute>}>
                  <Route index element={<Admin />} />
                  <Route path="audit-logs" element={<AuditLogs />} />
                  <Route path="compliance" element={<Compliance />} />
                </Route>

                {/* New Admin Dashboard */}
                <Route path="/admin" element={<AdminRoute><AdminLayoutComponent /></AdminRoute>}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="dashboard" element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboardNew />
                    </Suspense>
                  } />
                  <Route path="users" element={<UsersManagementPage />} />
                  <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                </Route>

                {/* Legacy dashboard routes - redirect to labs with toast */}
                <Route path="/dashboard" element={<LegacyRedirect to="/labs" message="Dashboard has moved to /labs" />} />
                <Route path="/dashboard/settings" element={<LegacyRedirect to="/settings" message="Settings has moved to /settings" />} />
                <Route path="/dashboard/upgrade" element={<LegacyRedirect to="/upgrade" message="Upgrade has moved to /upgrade" />} />
                <Route path="/dashboard/*" element={<LegacyRedirect to="/labs" message="Dashboard has moved to /labs" />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </EncryptionProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
