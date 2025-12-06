import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Datasets from "./pages/Datasets";
import DatasetDetail from "./pages/DatasetDetail";
import Finetuning from "./pages/Finetuning";
import FinetuningJobDetail from "./pages/FinetuningJobDetail";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/docs/api" element={<ApiDocs />} />
            <Route path="/docs/on-premises" element={<OnPremisesDeployment />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/dashboard/datasets" element={<ProtectedRoute><Datasets /></ProtectedRoute>} />
            <Route path="/dashboard/datasets/:id" element={<ProtectedRoute><DatasetDetail /></ProtectedRoute>} />
            <Route path="/dashboard/finetuning" element={<ProtectedRoute><Finetuning /></ProtectedRoute>} />
            <Route path="/dashboard/finetuning/:id" element={<ProtectedRoute><FinetuningJobDetail /></ProtectedRoute>} />
            <Route path="/dashboard/evaluations" element={<ProtectedRoute><Evaluations /></ProtectedRoute>} />
            <Route path="/dashboard/evaluations/:id" element={<ProtectedRoute><EvaluationDetail /></ProtectedRoute>} />
            <Route path="/dashboard/models" element={<ProtectedRoute><Models /></ProtectedRoute>} />
            <Route path="/dashboard/models/:id" element={<ProtectedRoute><ModelDetail /></ProtectedRoute>} />
            <Route path="/dashboard/catalog" element={<ProtectedRoute><ModelsCatalog /></ProtectedRoute>} />
            <Route path="/dashboard/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/dashboard/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/dashboard/traces" element={<ProtectedRoute><Traces /></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/dashboard/admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
            <Route path="/dashboard/admin/compliance" element={<AdminRoute><Compliance /></AdminRoute>} />
            <Route path="/design-system" element={<DesignSystem />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
