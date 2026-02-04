import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle, Key, Shield, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type LoginStep = "email_password" | "password_change" | "2fa_setup" | "2fa_verify";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // State
  const [step, setStep] = useState<LoginStep>("email_password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Step 1: Email/Password Login
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin-user/login", { email, password });
      return res.json();
    },
    onSuccess: (data) => {
      setTempToken(data.tempToken);
      
      if (data.step === "password_change_required") {
        setStep("password_change");
        toast({ title: "Password Change Required", description: data.message });
      } else if (data.step === "2fa_setup_required") {
        setStep("2fa_setup");
        fetch2FASetup(data.tempToken);
      } else if (data.step === "2fa_verification_required") {
        setStep("2fa_verify");
        toast({ title: "2FA Required", description: data.message });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Login Failed", 
        description: error.message || "Invalid credentials",
        variant: "destructive" 
      });
    },
  });

  // Step 2: Change Password
  const changePasswordMutation = useMutation({
    mutationFn: async ({ tempToken, newPassword }: { tempToken: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/admin-user/change-password", { tempToken, newPassword });
      return res.json();
    },
    onSuccess: (data) => {
      setTempToken(data.tempToken);
      setStep("2fa_setup");
      fetch2FASetup(data.tempToken);
      toast({ title: "Password Changed", description: "Now setup 2FA" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Password Change Failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Step 3: Fetch 2FA Setup (QR Code)
  const fetch2FASetup = async (token: string) => {
    try {
      const res = await fetch("/api/admin-user/2fa/setup", {
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      setQrCodeUrl(data.qrCodeUrl);
    } catch (error) {
      toast({ title: "2FA Setup Failed", variant: "destructive" });
    }
  };

  // Step 4: Enable 2FA (first time)
  const enable2FAMutation = useMutation({
    mutationFn: async ({ tempToken, totpToken }: { tempToken: string; totpToken: string }) => {
      const res = await apiRequest("POST", "/api/admin-user/2fa/enable", { tempToken, totpToken });
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("adminToken", data.authToken);
      localStorage.setItem("adminEmail", data.email);
      toast({ title: "Login Successful", description: "2FA enabled" });
      setLocation("/admin");
    },
    onError: (error: any) => {
      toast({ 
        title: "2FA Enable Failed", 
        description: error.message || "Invalid code",
        variant: "destructive" 
      });
    },
  });

  // Step 5: Verify 2FA (returning users)
  const verify2FAMutation = useMutation({
    mutationFn: async ({ tempToken, totpToken }: { tempToken: string; totpToken: string }) => {
      const res = await apiRequest("POST", "/api/admin-user/2fa/verify", { tempToken, totpToken });
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("adminToken", data.authToken);
      localStorage.setItem("adminEmail", data.email);
      toast({ title: "Login Successful" });
      setLocation("/admin");
    },
    onError: (error: any) => {
      toast({ 
        title: "2FA Verification Failed", 
        description: error.message || "Invalid code",
        variant: "destructive" 
      });
    },
  });

  // Form Handlers
  const handleEmailPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please enter email and password", variant: "destructive" });
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 12) {
      toast({ title: "Password must be at least 12 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ tempToken, newPassword });
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpToken.length !== 6) {
      toast({ title: "Please enter 6-digit code", variant: "destructive" });
      return;
    }
    
    if (step === "2fa_setup") {
      enable2FAMutation.mutate({ tempToken, totpToken });
    } else {
      verify2FAMutation.mutate({ tempToken, totpToken });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {step === "email_password" && <Lock className="w-8 h-8 text-primary" />}
            {step === "password_change" && <Key className="w-8 h-8 text-primary" />}
            {step === "2fa_setup" && <QrCode className="w-8 h-8 text-primary" />}
            {step === "2fa_verify" && <Shield className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "email_password" && "Admin Login"}
            {step === "password_change" && "Change Password"}
            {step === "2fa_setup" && "Setup 2FA"}
            {step === "2fa_verify" && "Enter 2FA Code"}
          </CardTitle>
          <CardDescription>
            {step === "email_password" && "Enter your admin credentials"}
            {step === "password_change" && "Create a strong password"}
            {step === "2fa_setup" && "Scan QR code with Google Authenticator"}
            {step === "2fa_verify" && "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Email/Password */}
          {step === "email_password" && (
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-primary/20"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-primary/20"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Authenticating..." : "Continue"}
              </Button>
            </form>
          )}

          {/* Step 2: Password Change */}
          {step === "password_change" && (
            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                Password requirements: min 12 chars, uppercase, lowercase, number, special char
              </div>
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">New Password</label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-primary/20"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-primary/20"
                />
              </div>
              <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </form>
          )}

          {/* Step 3: 2FA Setup */}
          {step === "2fa_setup" && (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-64 h-64 border-2 border-primary/20 rounded-lg" />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="totpToken" className="text-sm font-medium">Enter 6-digit Code</label>
                <Input
                  id="totpToken"
                  type="text"
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="border-primary/20 text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={enable2FAMutation.isPending}>
                {enable2FAMutation.isPending ? "Verifying..." : "Enable 2FA & Login"}
              </Button>
            </form>
          )}

          {/* Step 4: 2FA Verify */}
          {step === "2fa_verify" && (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="totpToken" className="text-sm font-medium">Enter 6-digit Code</label>
                <Input
                  id="totpToken"
                  type="text"
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="border-primary/20 text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={verify2FAMutation.isPending}>
                {verify2FAMutation.isPending ? "Verifying..." : "Verify & Login"}
              </Button>
            </form>
          )}

          <div className="mt-4">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setLocation("/")}
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
