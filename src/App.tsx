import { useEffect } from "react";
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

// Layouts
import { ChatLayout } from "@/layouts/ChatLayout";
import { LabsLayout } from "@/layouts/LabsLayout";
import { MarketingLayout } from "@/layouts/MarketingLayout";

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
import OAuthCallback from "./pages/OAuthCallback";
import VaultChatFeatures from "./pages/VaultChatFeatures";
import VaultLabsFeatures from "./pages/VaultLabsFeatures";
import APIPricing from "./pages/APIPricing";
import Agents from "./pages/Agents";
import AgentsStudio from "./pages/AgentsStudio";
import Studio from "./pages/Studio";
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
                <Route path="/status" element={<MarketingLayout><Status /></MarketingLayout>} />
                <Route path="/features/vault-chat" element={<MarketingLayout><VaultChatFeatures /></MarketingLayout>} />
                <Route path="/features/vault-labs" element={<MarketingLayout><VaultLabsFeatures /></MarketingLayout>} />
                <Route path="/api-pricing" element={<MarketingLayout><APIPricing /></MarketingLayout>} />

                {/* Vault Chat routes (simple mode) */}
                <Route path="/chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>}>
                  <Route index element={<VaultChat />} />
                  <Route path=":conversationId" element={<VaultChat />} />
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
                <Route path="/ghost/agents" element={<ProtectedRoute><ErrorBoundary><Agents /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/ghost/agents/studio" element={<ProtectedRoute><ErrorBoundary><AgentsStudio /></ErrorBoundary></ProtectedRoute>} />
                
                {/* Top-level convenience routes */}
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/agents" element={<ProtectedRoute><ErrorBoundary><Agents /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/agents/studio" element={<ProtectedRoute><ErrorBoundary><AgentsStudio /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><ErrorBoundary><Studio /></ErrorBoundary></ProtectedRoute>} />
                
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

                {/* Legacy dashboard routes - redirect to labs with toast */}
                <Route path="/dashboard" element={<LegacyRedirect to="/labs" message="Dashboard has moved to /labs" />} />
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
