import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, TrendingUp, Watch, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface HealthConnection {
  id: string;
  platform: string;
  status: string;
  connectedAt: string;
  lastSyncAt?: string;
}

interface HealthConnectButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  showLabel?: boolean;
  className?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  'apple_health': 'Apple Health',
  'google_fit': 'Google Fit',
  'samsung_health': 'Samsung Health',
  'fitbit': 'Fitbit',
  'oura': 'Oura Ring',
  'whoop': 'WHOOP',
  'garmin': 'Garmin',
};

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  'apple_health': 'Synka steg, kalorier, sömndata och träningspass från Apple Health',
  'google_fit': 'Synka aktivitetsdata och träningspass från Google Fit',
  'samsung_health': 'Synka hälsodata och träningspass från Samsung Health',
  'fitbit': 'Synka aktivitet, sömn och puls från din Fitbit',
  'oura': 'Synka sömn, återhämtning och aktivitetsdata från din Oura Ring',
  'whoop': 'Synka återhämtning, belastning och sömndata från WHOOP',
  'garmin': 'Synka träningspass och hälsodata från Garmin',
};

export default function HealthConnectButton({ 
  variant = "default", 
  size = "default",
  showLabel = true,
  className = "",
}: HealthConnectButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const baselineCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const { data: connections = [], refetch: refetchConnections } = useQuery<HealthConnection[]>({
    queryKey: ['/api/health/connections'],
  });

  const hasConnections = connections.length > 0;
  const activeConnections = connections.filter(c => c.status === 'active');

  const cleanupPolling = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    baselineCountRef.current = connections.length;

    try {
      const res = await apiRequest('POST', '/api/health/connect');
      const response = await res.json() as { success?: boolean; linkUrl?: string; linkToken?: string };

      if (!response.success || !response.linkUrl) {
        setIsConnecting(false);
        toast({
          title: "Kunde inte starta koppling",
          description: "Försök igen om en stund.",
          variant: "destructive",
        });
        return;
      }

      window.open(response.linkUrl, '_blank', 'width=500,height=700');
      
      intervalRef.current = window.setInterval(async () => {
        try {
          const updatedConnections = await refetchConnections();
          const currentLen = updatedConnections.data?.length ?? 0;
          if (currentLen > baselineCountRef.current) {
            cleanupPolling();
            setIsConnecting(false);
            setDialogOpen(false);
            toast({
              title: "Ansluten!",
              description: "Din hälsoplattform är nu ansluten och synkar data.",
            });
          }
        } catch {
          cleanupPolling();
          setIsConnecting(false);
          toast({
            title: "Kontroll misslyckades",
            description: "Kunde inte verifiera anslutning. Ladda om sidan för att se status.",
            variant: "destructive",
          });
        }
      }, 3000);

      timeoutRef.current = window.setTimeout(() => {
        cleanupPolling();
        setIsConnecting(false);
        toast({
          title: "Timeout",
          description: "Anslutningen tog för lång tid. Ladda om sidan för att se status.",
          variant: "destructive",
        });
      }, 120000);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Kunde inte ansluta till hälsoplattform. Försök igen.";
      toast({
        title: "Anslutning misslyckades",
        description: errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await apiRequest('DELETE', `/api/health/connections/${platform}`);

      await refetchConnections();
      
      toast({
        title: "Frånkopplad",
        description: `${PLATFORM_LABELS[platform] || platform} har kopplats bort.`,
      });
    } catch (error: any) {
      console.error('Failed to disconnect:', error);
      toast({
        title: "Frånkoppling misslyckades",
        description: "Kunde inte koppla bort plattformen. Försök igen.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setDialogOpen(true)}
        data-testid="button-health-connect"
      >
        <Heart className="w-4 h-4" />
        {showLabel && (
          <span>
            {hasConnections ? `${activeConnections.length} ansluten${activeConnections.length !== 1 ? 'a' : ''}` : 'Anslut hälsodata'}
          </span>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-health-connect">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Hälsodataintegration
            </DialogTitle>
            <DialogDescription>
              Anslut dina hälsoplattformar för att synka träningsdata, återhämtning och aktivitet automatiskt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {activeConnections.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Anslutna plattformar</h3>
                {activeConnections.map((connection) => (
                  <Card key={connection.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {PLATFORM_LABELS[connection.platform] || connection.platform}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ansluten {new Date(connection.connectedAt).toLocaleDateString('sv-SE')}
                          </p>
                          {connection.lastSyncAt && (
                            <p className="text-xs text-muted-foreground">
                              Senaste synk: {new Date(connection.lastSyncAt).toLocaleString('sv-SE')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => handleDisconnect(connection.platform)}
                        data-testid={`button-disconnect-${connection.platform}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {activeConnections.length > 0 ? 'Lägg till fler' : 'Tillgängliga plattformar'}
              </h3>
              
              <Card className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Multi-plattformsstöd
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Anslut Apple Health, Google Fit, Fitbit, Oura, WHOOP, Garmin och fler plattformar.
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" />
                        Steg, kalorier och aktivitetsdata
                      </li>
                      <li className="flex items-center gap-2">
                        <Heart className="w-3 h-3" />
                        Puls, HRV och återhämtning
                      </li>
                      <li className="flex items-center gap-2">
                        <Watch className="w-3 h-3" />
                        Sömndata och konditionsmått
                      </li>
                    </ul>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleConnect}
                  disabled={isConnecting}
                  data-testid="button-connect-platform"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ansluter...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      Anslut plattform
                    </>
                  )}
                </Button>
              </Card>
            </div>

            {activeConnections.length === 0 && (
              <Card className="p-4 bg-muted/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Manuell inmatning tillgänglig
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Om du inte vill ansluta en hälsoplattform kan du alltid mata in data manuellt i din profil.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
