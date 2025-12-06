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
import Finetuning from "./pages/Finetuning";
import Evaluations from "./pages/Evaluations";
import Models from "./pages/Models";
import ModelsCatalog from "./pages/ModelsCatalog";
import Playground from "./pages/Playground";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Stats from "./pages/Stats";
import Traces from "./pages/Traces";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import DesignSystem from "./pages/DesignSystem";

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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/dashboard/datasets" element={<ProtectedRoute><Datasets /></ProtectedRoute>} />
            <Route path="/dashboard/finetuning" element={<ProtectedRoute><Finetuning /></ProtectedRoute>} />
            <Route path="/dashboard/evaluations" element={<ProtectedRoute><Evaluations /></ProtectedRoute>} />
            <Route path="/dashboard/models" element={<ProtectedRoute><Models /></ProtectedRoute>} />
            <Route path="/dashboard/catalog" element={<ProtectedRoute><ModelsCatalog /></ProtectedRoute>} />
            <Route path="/dashboard/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/dashboard/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/dashboard/traces" element={<ProtectedRoute><Traces /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/design-system" element={<DesignSystem />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
