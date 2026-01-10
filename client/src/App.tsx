import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import BabyProfile from "./pages/BabyProfile";
import DailyLog from "./pages/DailyLog";
import Chatbot from "./pages/Chatbot";
import Nutrition from "./pages/Nutrition";
import Analytics from "./pages/Analytics";
import CryAnalysis from "./pages/CryAnalysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/baby-profile"
                element={
                  <RequireAuth>
                    <BabyProfile />
                  </RequireAuth>
                }
              />
              <Route
                path="/daily-log"
                element={
                  <RequireAuth>
                    <DailyLog />
                  </RequireAuth>
                }
              />
              <Route
                path="/chatbot"
                element={
                  <RequireAuth>
                    <Chatbot />
                  </RequireAuth>
                }
              />
              <Route
                path="/nutrition"
                element={
                  <RequireAuth>
                    <Nutrition />
                  </RequireAuth>
                }
              />
              <Route
                path="/analytics"
                element={
                  <RequireAuth>
                    <Analytics />
                  </RequireAuth>
                }
              />
              <Route
                path="/cry-analysis"
                element={
                  <RequireAuth>
                    <CryAnalysis />
                  </RequireAuth>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
