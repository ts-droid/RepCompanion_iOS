import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile } from "@shared/schema";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import AdjustTraining from "@/pages/AdjustTraining";
import EditProgram from "@/pages/EditProgram";
import ProgramGenerating from "@/pages/ProgramGenerating";
import Gyms from "@/pages/Gyms";
import Alternatives from "@/pages/Alternatives";
import WorkoutDetail from "@/pages/WorkoutDetail";
import Onboarding from "@/pages/Onboarding";
import Warmup from "@/pages/Warmup";
import ActiveSession from "@/pages/ActiveSession";
import SessionComplete from "@/pages/SessionComplete";
import SessionDetails from "@/pages/SessionDetails";
import Progress from "@/pages/Progress";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/not-found";

function LoadingSpinner({ message = "Laddar..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, params }: { component: React.ComponentType<any>; params?: any }) {
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile"],
    retry: false,
  });

  if (profileLoading) {
    return <LoadingSpinner message="Laddar profil..." />;
  }

  if (!profile || !profile.onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }

  return <Component {...params} />;
}

function AdminProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile"],
    retry: false,
  });

  // Check for admin JWT token in localStorage
  const adminToken = localStorage.getItem("adminToken");

  if (profileLoading) {
    return <LoadingSpinner message="Laddar profil..." />;
  }

  // Admin users are separate - don't need regular user profile
  // Just check if admin token exists
  if (!adminToken) {
    return <Redirect to="/admin/login" />;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 animate-pulse">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-semibold">RepCompanion</p>
            <p className="text-muted-foreground text-sm">Laddar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/dev-onboarding" component={Onboarding} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">{() => <AdminProtectedRoute component={AdminDashboard} />}</Route>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/">{() => <ProtectedRoute component={Dashboard} />}</Route>
          <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
          <Route path="/profile">{() => <ProtectedRoute component={Profile} />}</Route>
          <Route path="/adjust-training">{() => <ProtectedRoute component={AdjustTraining} />}</Route>
          <Route path="/edit-program/:id">{(params) => <ProtectedRoute component={EditProgram} params={params} />}</Route>
          <Route path="/generating-program">{() => <ProtectedRoute component={ProgramGenerating} />}</Route>
          <Route path="/gyms">{() => <ProtectedRoute component={Gyms} />}</Route>
          <Route path="/alternatives">{() => <ProtectedRoute component={Alternatives} />}</Route>
          <Route path="/workout/:id">{(params) => <ProtectedRoute component={WorkoutDetail} params={params} />}</Route>
          <Route path="/warmup">{() => <ProtectedRoute component={Warmup} />}</Route>
          <Route path="/session/start">{() => <ProtectedRoute component={ActiveSession} />}</Route>
          <Route path="/session/active">{() => <ProtectedRoute component={ActiveSession} />}</Route>
          <Route path="/session/complete">{() => <ProtectedRoute component={SessionComplete} />}</Route>
          <Route path="/session/:sessionId">{(params) => <ProtectedRoute component={SessionDetails} params={params} />}</Route>
          <Route path="/progress">{() => <ProtectedRoute component={Progress} />}</Route>
          <Route path="/onboarding" component={Onboarding} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
