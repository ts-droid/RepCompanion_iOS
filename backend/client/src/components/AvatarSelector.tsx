import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import Avatar, { genConfig } from "react-nice-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Wand2, Smile } from "lucide-react";
import type { UserProfile } from "@shared/schema";

const EMOJIS = ["💪", "🏋️", "🤸", "🧘", "🏃", "⚡", "🔥", "🎯", "🚀", "💯", "🏆", "⭐"];

interface AvatarSelectorProps {
  profile: UserProfile;
  onClose: () => void;
}

interface AvatarConfig {
  sex?: string;
  hairStyle?: string;
  eyeType?: string;
  [key: string]: any;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve(file);
    };

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onerror = () => {
        resolve(file);
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }

        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            return resolve(file);
          }
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        }, "image/jpeg", 0.8);
      };
    };

    reader.readAsDataURL(file);
  });
}

export default function AvatarSelector({
  profile,
  onClose,
}: AvatarSelectorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"emoji" | "image" | "generated">("emoji");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<AvatarConfig>(
    (profile.avatarConfig as AvatarConfig) || genConfig()
  );
  const [isUploading, setIsUploading] = useState(false);

  const updateAvatarMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Avatar uppdaterad",
        description: "Din profil-avatar har uppdaterats",
      });
      onClose();
    },
  });

  const handleEmojiSelect = (emoji: string) => {
    updateAvatarMutation.mutate({
      avatarType: "emoji",
      avatarEmoji: emoji,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fil för stor",
        description: "Maximal filstorlek är 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append("image", compressedFile);

      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      const { imageUrl } = await response.json();

      updateAvatarMutation.mutate({
        avatarType: "image",
        avatarImageUrl: imageUrl,
      });
    } catch (error) {
      toast({
        title: "Upload misslyckades",
        description: "Kunde inte ladda upp bilden",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGeneratedAvatarSave = () => {
    updateAvatarMutation.mutate({
      avatarType: "generated",
      avatarConfig: generatedConfig,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6">Välj din avatar</h2>

          {/* Mode Selector */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === "emoji" ? "default" : "outline"}
              onClick={() => setMode("emoji")}
              className="flex-1"
            >
              <Smile className="w-4 h-4 mr-2" />
              Emoji
            </Button>
            <Button
              variant={mode === "image" ? "default" : "outline"}
              onClick={() => setMode("image")}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bild
            </Button>
            <Button
              variant={mode === "generated" ? "default" : "outline"}
              onClick={() => setMode("generated")}
              className="flex-1"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Skapa
            </Button>
          </div>

          {/* Emoji Mode */}
          {mode === "emoji" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Välj en emoji</p>
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="text-3xl p-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid={`button-emoji-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Mode */}
          {mode === "image" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Ladda upp en bild från din telefon</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                data-testid="input-avatar-image"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={isUploading}
                data-testid="button-upload-image"
              >
                {isUploading ? "Laddar upp..." : "Välj bild från album"}
              </Button>
              {previewImage && (
                <div className="mt-4">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-32 h-32 rounded-lg object-cover mx-auto"
                  />
                </div>
              )}
            </div>
          )}

          {/* Generated Avatar Mode */}
          {mode === "generated" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Skapa din egen personliga avatar</p>

              <div className="flex justify-center mb-6">
                <Avatar
                  style={{ width: "120px", height: "120px" }}
                  {...(generatedConfig as any)}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Kön</label>
                  <select
                    value={generatedConfig.sex || "man"}
                    onChange={(e) =>
                      setGeneratedConfig({
                        ...generatedConfig,
                        sex: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-avatar-sex"
                  >
                    <option value="man">Man</option>
                    <option value="woman">Kvinna</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Frisyr</label>
                  <select
                    value={generatedConfig.hairStyle || "hair1"}
                    onChange={(e) =>
                      setGeneratedConfig({
                        ...generatedConfig,
                        hairStyle: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-avatar-hair"
                  >
                    <option value="hair1">Frisyr 1</option>
                    <option value="hair2">Frisyr 2</option>
                    <option value="hair3">Frisyr 3</option>
                    <option value="hair4">Frisyr 4</option>
                    <option value="hair5">Frisyr 5</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Ögon</label>
                  <select
                    value={generatedConfig.eyeType || "eye1"}
                    onChange={(e) =>
                      setGeneratedConfig({
                        ...generatedConfig,
                        eyeType: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-avatar-eyes"
                  >
                    <option value="eye1">Ögon 1</option>
                    <option value="eye2">Ögon 2</option>
                    <option value="eye3">Ögon 3</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Slumpmässig avatar</label>
                  <Button
                    onClick={() => setGeneratedConfig(genConfig())}
                    variant="outline"
                    className="w-full"
                    data-testid="button-randomize-avatar"
                  >
                    🎲 Slumpa ny
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleGeneratedAvatarSave}
                className="w-full mt-4"
                data-testid="button-save-generated-avatar"
              >
                Spara avatar
              </Button>
            </div>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full mt-6"
            data-testid="button-close-avatar-selector"
          >
            Stäng
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
