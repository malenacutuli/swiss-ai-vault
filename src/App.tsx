import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { FirstTimeOrganizationModal } from "@/components/FirstTimeOrganizationModal";
import { chatEncryption } from "@/lib/encryption";

// Layouts
import { ChatLayout } from "@/layouts/ChatLayout";
import { LabsLayout } from "@/layouts/LabsLayout";

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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import Contact from "./pages/Contact";
import DPA from "./pages/DPA";
import Status from "./pages/Status";
import OAuthCallback from "./pages/OAuthCallback";
import VaultChatFeatures from "./pages/VaultChatFeatures";
import VaultLabsFeatures from "./pages/VaultLabsFeatures";

const queryClient = new QueryClient();

const App = () => {
  // Initialize Vault Chat encryption on app start
  useEffect(() => {
    chatEncryption.initialize()
      .then(() => console.log('✅ Vault Chat encryption ready'))
      .catch((err) => console.error('❌ Vault Chat encryption init failed:', err));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <FirstTimeOrganizationModal />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/docs/api" element={<ApiDocs />} />
              <Route path="/docs/on-premises" element={<OnPremisesDeployment />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/design-system" element={<DesignSystem />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/dpa" element={<DPA />} />
              <Route path="/status" element={<Status />} />
              <Route path="/features/vault-chat" element={<VaultChatFeatures />} />
              <Route path="/features/vault-labs" element={<VaultLabsFeatures />} />

              {/* Vault Chat routes (simple mode) */}
              <Route path="/vault-chat" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>}>
                <Route index element={<VaultChat />} />
                <Route path=":conversationId" element={<VaultChat />} />
              </Route>
              
              {/* Legacy chat routes - redirect to new paths */}
              <Route path="/chat" element={<Navigate to="/vault-chat" replace />} />
              <Route path="/secure-chat" element={<Navigate to="/vault-chat" replace />} />
              <Route path="/secure-chat/:conversationId" element={<Navigate to="/vault-chat" replace />} />

              {/* Vault Labs routes (full mode) */}
              <Route path="/dashboard" element={<ProtectedRoute><LabsLayout /></ProtectedRoute>}>
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
                <Route path="vault-chat/integrations" element={<VaultChatIntegrations />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="stats" element={<Stats />} />
                <Route path="traces" element={<Traces />} />
                <Route path="billing" element={<Billing />} />
              </Route>

              {/* Admin routes */}
              <Route path="/dashboard/admin" element={<AdminRoute><LabsLayout /></AdminRoute>}>
                <Route index element={<Admin />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="compliance" element={<Compliance />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
