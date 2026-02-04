import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Camera, QrCode, X, Check, Loader2, Sparkles, Zap } from "lucide-react";
import { parseQRCode, type EquipmentType } from "@shared/equipment-mapping";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface EquipmentScannerProps {
  open: boolean;
  onClose: () => void;
  onEquipmentDetected: (equipment: EquipmentType[]) => void;
}

export function EquipmentScanner({ open, onClose, onEquipmentDetected }: EquipmentScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "qr">("camera");
  const [isScanning, setIsScanning] = useState(false);
  const [detectedEquipment, setDetectedEquipment] = useState<EquipmentType[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  const recognizeMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      return apiRequest("POST", "/api/equipment/recognize", { image: imageBase64 });
    },
    onSuccess: (data: any) => {
      if (data.equipment && data.equipment.length > 0) {
        setDetectedEquipment(data.equipment);
        setConfidence(data.confidence || 0);
        toast({
          title: "Equipment Detected!",
          description: `Found ${data.equipment.length} item(s)`,
        });
      } else {
        toast({
          title: "No Equipment Detected",
          description: "Try getting closer or adjusting the angle",
          variant: "destructive",
        });
      }
      setIsScanning(false);
    },
    onError: () => {
      toast({
        title: "Recognition Failed",
        description: "Could not recognize equipment. Please try again.",
        variant: "destructive",
      });
      setIsScanning(false);
    },
  });

  useEffect(() => {
    if (open && activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    if (open && activeTab === "qr") {
      startQRScanner();
    } else {
      stopQRScanner();
    }

    return () => {
      stopCamera();
      stopQRScanner();
    };
  }, [open, activeTab]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startQRScanner = () => {
    if (!open) return;
    
    setTimeout(() => {
      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 250 },
        false
      );

      qrScanner.render(
        (decodedText) => {
          const equipment = parseQRCode(decodedText);
          if (equipment.length > 0) {
            setDetectedEquipment(equipment);
            toast({
              title: "QR Code Scanned!",
              description: `Found ${equipment.length} item(s)`,
            });
          } else {
            toast({
              title: "Unknown QR Code",
              description: "This QR code is not recognized as gym equipment",
              variant: "destructive",
            });
          }
        },
        (error) => {
          console.warn("QR scan error:", error);
        }
      );

      qrScannerRef.current = qrScanner;
    }, 100);
  };

  const stopQRScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.clear().catch(console.error);
      qrScannerRef.current = null;
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setIsScanning(true);
        recognizeMutation.mutate(base64);
      };
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.8);
  };

  const handleConfirm = () => {
    if (detectedEquipment.length > 0) {
      onEquipmentDetected(detectedEquipment);
      handleClose();
    }
  };

  const handleClose = () => {
    setDetectedEquipment([]);
    setConfidence(0);
    setIsScanning(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Equipment</DialogTitle>
          <DialogDescription>
            Use your camera to automatically recognize gym equipment
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "camera" | "qr")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera" data-testid="tab-camera-scan" className="relative">
              <Camera className="w-4 h-4 mr-2" />
              Camera AI
              <Badge variant="default" className="ml-2 text-xs px-1.5 py-0">
                <Sparkles className="w-3 h-3 mr-1" />
                Recommended
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="qr" data-testid="tab-qr-scan">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
              <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                <Zap className="w-3 h-3 mr-1" />
                Faster
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="space-y-4">
            <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">AI Recognition - Works Everywhere</h4>
                  <p className="text-xs text-muted-foreground">
                    Point your camera at any gym equipment and let AI identify it automatically. 
                    Works with 29+ equipment types from any manufacturer.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative bg-card rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-64 object-cover"
                data-testid="video-camera-feed"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isScanning && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
            </div>

            <Button
              onClick={captureImage}
              disabled={isScanning}
              className="w-full"
              data-testid="button-capture-image"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture & Analyze
                </>
              )}
            </Button>

            {detectedEquipment.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Detected {detectedEquipment.length} equipment{detectedEquipment.length > 1 ? 's' : ''}
                  {confidence > 0 && ` (${(confidence * 100).toFixed(0)}% confidence)`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {detectedEquipment.map((eq, idx) => (
                    <div
                      key={idx}
                      className="bg-primary/10 border border-primary text-primary px-3 py-1 rounded-full text-sm"
                      data-testid={`detected-equipment-${idx}`}
                    >
                      {eq}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleConfirm}
                  className="w-full"
                  data-testid="button-confirm-detected"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="space-y-4">
            <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">QR Code - Instant Recognition</h4>
                  <p className="text-xs text-muted-foreground">
                    Scan QR codes if your gym has them on equipment. Faster than AI but requires pre-printed codes.
                  </p>
                </div>
              </div>
            </div>

            <div id="qr-reader" className="w-full" data-testid="qr-scanner-container" />
            
            {detectedEquipment.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Scanned {detectedEquipment.length} equipment{detectedEquipment.length > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {detectedEquipment.map((eq, idx) => (
                    <div
                      key={idx}
                      className="bg-primary/10 border border-primary text-primary px-3 py-1 rounded-full text-sm"
                      data-testid={`detected-equipment-${idx}`}
                    >
                      {eq}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleConfirm}
                  className="w-full"
                  data-testid="button-confirm-detected"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
