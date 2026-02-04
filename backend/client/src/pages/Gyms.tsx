import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, MapPin, Check, Trash2, Dumbbell, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EquipmentScanner } from "@/components/EquipmentScanner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { equipmentOptions } from "@shared/equipment-mapping";
import type { Gym, UserEquipment, UserProfile } from "@shared/schema";

export default function Gyms() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newGymName, setNewGymName] = useState("");
  const [newGymLocation, setNewGymLocation] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [pendingGymId, setPendingGymId] = useState<string | null>(null);
  
  const [editGymId, setEditGymId] = useState<string | null>(null);
  const [editGymName, setEditGymName] = useState("");
  const [editGymLocation, setEditGymLocation] = useState("");
  const [editEquipmentSelectorOpen, setEditEquipmentSelectorOpen] = useState(false);
  const [editSelectedEquipment, setEditSelectedEquipment] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [gymToDelete, setGymToDelete] = useState<string | null>(null);

  const { data: gyms, isLoading } = useQuery<Gym[]>({
    queryKey: ["/api/gyms"],
  });

  const { data: equipment } = useQuery<UserEquipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const createGymMutation = useMutation({
    mutationFn: async (data: { name: string; location?: string }) => {
      const res = await apiRequest("POST", "/api/gyms", data);
      return res.json() as Promise<Gym>;
    },
    onSuccess: (newGym: Gym) => {
      setPendingGymId(newGym.id);
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      toast({
        title: "Gym skapat",
        description: "Nu kan du lägga till utrustning",
      });
    },
    onError: () => {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte skapa gym",
        variant: "destructive",
      });
    },
  });

  const selectGymMutation = useMutation({
    mutationFn: async (gymId: string) => {
      return apiRequest("PATCH", `/api/gyms/${gymId}/select`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Gym valt",
        description: "Gymmet är nu valt för träning",
      });
    },
    onError: () => {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte välja gym",
        variant: "destructive",
      });
    },
  });

  const handleSelectGym = (gymId: string) => {
    selectGymMutation.mutate(gymId);
  };

  const deleteGymMutation = useMutation({
    mutationFn: async (gymId: string) => {
      // Backend auto-selects another gym if deleting the selected one
      return apiRequest("DELETE", `/api/gyms/${gymId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setDeleteConfirmOpen(false);
      setGymToDelete(null);
      setEditGymId(null);
      toast({
        title: "Gym raderat",
        description: "Gymmet och dess utrustning har raderats",
      });
    },
    onError: () => {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte radera gym",
        variant: "destructive",
      });
    },
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (data: { gymId: string; equipmentName: string }) => {
      return apiRequest("POST", "/api/equipment", {
        gymId: data.gymId,
        equipmentType: "gym",
        equipmentName: data.equipmentName,
        available: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
  });

  const updateGymMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; location?: string }) => {
      return apiRequest("PATCH", `/api/gyms/${data.id}`, {
        name: data.name,
        location: data.location,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gyms"] });
      setEditGymId(null);
      setEditGymName("");
      setEditGymLocation("");
      toast({
        title: "Gym uppdaterat",
        description: "Ändringar har sparats",
      });
    },
    onError: () => {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera gym",
        variant: "destructive",
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      return apiRequest("DELETE", `/api/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Utrustning borttagen",
      });
    },
    onError: () => {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort utrustning",
        variant: "destructive",
      });
    },
  });

  const handleCreateGym = async () => {
    if (!newGymName.trim()) {
      toast({
        title: "Namn saknas",
        description: "Ange ett namn för gymmet",
        variant: "destructive",
      });
      return;
    }

    await createGymMutation.mutateAsync({
      name: newGymName,
      location: newGymLocation || undefined,
    });
  };

  const handleAddEquipment = async () => {
    if (!pendingGymId || selectedEquipment.length === 0) {
      toast({
        title: "Ingen utrustning vald",
        description: "Välj minst en utrustning",
        variant: "destructive",
      });
      return;
    }

    const promises = selectedEquipment.map(eq =>
      addEquipmentMutation.mutateAsync({
        gymId: pendingGymId,
        equipmentName: eq,
      })
    );

    await Promise.all(promises);

    setCreateDialogOpen(false);
    setPendingGymId(null);
    setNewGymName("");
    setNewGymLocation("");
    setSelectedEquipment([]);

    toast({
      title: "Utrustning tillagd",
      description: `${selectedEquipment.length} utrustning tillagd`,
    });
  };

  const toggleEquipment = (eq: string) => {
    setSelectedEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  const handleEquipmentDetected = (detected: string[]) => {
    const newEquipment = detected.filter(eq => !selectedEquipment.includes(eq));
    if (newEquipment.length > 0) {
      setSelectedEquipment(prev => [...prev, ...newEquipment]);
      toast({
        title: "Utrustning tillagd",
        description: `${newEquipment.length} ny utrustning`,
      });
    }
  };

  const getGymEquipmentCount = (gymId: string) => {
    return equipment?.filter(e => e.gymId === gymId).length || 0;
  };

  const handleEditGym = (gym: Gym) => {
    setEditGymId(gym.id);
    setEditGymName(gym.name);
    setEditGymLocation(gym.location || "");
    setEditSelectedEquipment([]);
  };

  const handleSaveGym = async () => {
    if (!editGymId || !editGymName.trim()) {
      toast({
        title: "Namn saknas",
        description: "Ange ett namn för gymmet",
        variant: "destructive",
      });
      return;
    }

    await updateGymMutation.mutateAsync({
      id: editGymId,
      name: editGymName,
      location: editGymLocation || undefined,
    });
  };

  const handleAddEquipmentToEditGym = async () => {
    if (!editGymId || editSelectedEquipment.length === 0) {
      toast({
        title: "Ingen utrustning vald",
        description: "Välj minst en utrustning",
        variant: "destructive",
      });
      return;
    }

    const promises = editSelectedEquipment.map(eq =>
      addEquipmentMutation.mutateAsync({
        gymId: editGymId,
        equipmentName: eq,
      })
    );

    await Promise.all(promises);
    setEditSelectedEquipment([]);
    setEditEquipmentSelectorOpen(false);

    toast({
      title: "Utrustning tillagd",
      description: `${editSelectedEquipment.length} utrustning tillagd`,
    });
  };

  const toggleEditEquipment = (eq: string) => {
    setEditSelectedEquipment(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  const handleEquipmentDetectedForEdit = async (detected: string[]) => {
    if (!editGymId) return;
    
    const existingEquipment = getGymEquipment(editGymId).map(e => e.equipmentName);
    const newEquipment = detected.filter(eq => !existingEquipment.includes(eq));
    
    if (newEquipment.length > 0) {
      try {
        const promises = newEquipment.map(eq =>
          addEquipmentMutation.mutateAsync({
            gymId: editGymId,
            equipmentName: eq,
          })
        );
        await Promise.all(promises);
        
        toast({
          title: "Utrustning sparad",
          description: `${newEquipment.length} ny utrustning tillagd`,
        });
      } catch (error) {
        toast({
          title: "Ett fel uppstod",
          description: "Kunde inte spara utrustning",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Redan tillagd",
        description: "Denna utrustning finns redan",
      });
    }
  };

  const getGymEquipment = (gymId: string) => {
    return equipment?.filter(e => e.gymId === gymId) || [];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/profile")}
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">Mina Gym</h1>
          <Button
            size="icon"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-add-gym"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {gyms && gyms.length > 0 ? (
          gyms.map((gym) => {
            const isSelected = gym.id === profile?.selectedGymId;
            return (
              <Card 
                key={gym.id} 
                className={`${isSelected ? "border-2 border-primary bg-primary/30 ring-2 ring-primary/50" : "border"} ${!isSelected && !deleteGymMutation.isPending ? "cursor-pointer" : ""}`}
                onClick={() => !isSelected && !deleteGymMutation.isPending && handleSelectGym(gym.id)}
                data-testid={`gym-card-${gym.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        {gym.name}
                        {isSelected && (
                          <Badge variant="default" className="ml-2">Valt Gym</Badge>
                        )}
                      </CardTitle>
                      {gym.location && (
                        <p className="text-sm text-muted-foreground mt-1">{gym.location}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditGym(gym);
                      }}
                      data-testid={`button-edit-gym-${gym.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">
                        {getGymEquipmentCount(gym.id)} utrustning
                      </span>
                    </div>
                  </div>

                  {!isSelected && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      Klicka för att välja detta gym
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Inga gym ännu</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Skapa Första Gymmet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingGymId ? "Lägg till utrustning" : "Skapa nytt gym"}</DialogTitle>
          </DialogHeader>

          {!pendingGymId ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="gym-name">Gym-namn *</Label>
                <Input
                  id="gym-name"
                  value={newGymName}
                  onChange={(e) => setNewGymName(e.target.value)}
                  placeholder="t.ex. SATS Östermalm"
                  data-testid="input-gym-name"
                />
              </div>

              <div>
                <Label htmlFor="gym-location">Plats (valfritt)</Label>
                <Input
                  id="gym-location"
                  value={newGymLocation}
                  onChange={(e) => setNewGymLocation(e.target.value)}
                  placeholder="t.ex. Stockholm"
                  data-testid="input-gym-location"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreateGym}
                disabled={createGymMutation.isPending}
                data-testid="button-create-gym"
              >
                {createGymMutation.isPending ? "Skapar..." : "Nästa: Lägg till utrustning"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setScannerOpen(true)}
                className="w-full"
                data-testid="button-scan-equipment-gym"
              >
                <Dumbbell className="w-4 h-4 mr-2" />
                Skanna Utrustning
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Eller välj manuellt</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {equipmentOptions.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => toggleEquipment(eq)}
                    className={`p-3 rounded-lg border text-left text-sm hover-elevate active-elevate-2 relative ${
                      selectedEquipment.includes(eq)
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-card-border"
                    }`}
                    data-testid={`equipment-${eq.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {eq}
                    {selectedEquipment.includes(eq) && (
                      <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setPendingGymId(null);
                    setSelectedEquipment([]);
                  }}
                >
                  Hoppa över
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddEquipment}
                  disabled={selectedEquipment.length === 0 || addEquipmentMutation.isPending}
                  data-testid="button-add-equipment"
                >
                  Lägg till ({selectedEquipment.length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EquipmentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onEquipmentDetected={handleEquipmentDetected}
      />

      <Dialog open={!!editGymId} onOpenChange={(open) => !open && setEditGymId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera {editGymName || "Gym"}</DialogTitle>
            <DialogDescription>
              Uppdatera gymnamn, plats och hantera utrustning
            </DialogDescription>
          </DialogHeader>

          {!editEquipmentSelectorOpen ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-gym-name">Gym-namn *</Label>
                <Input
                  id="edit-gym-name"
                  value={editGymName}
                  onChange={(e) => setEditGymName(e.target.value)}
                  placeholder="t.ex. SATS Östermalm"
                  data-testid="input-edit-gym-name"
                />
              </div>

              <div>
                <Label htmlFor="edit-gym-location">Plats (valfritt)</Label>
                <Input
                  id="edit-gym-location"
                  value={editGymLocation}
                  onChange={(e) => setEditGymLocation(e.target.value)}
                  placeholder="t.ex. Stockholm"
                  data-testid="input-edit-gym-location"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base">Utrustning</Label>
                  <Button
                    size="sm"
                    onClick={() => setEditEquipmentSelectorOpen(true)}
                    data-testid="button-add-equipment-edit"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Lägg till
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editGymId && getGymEquipment(editGymId).length > 0 ? (
                    getGymEquipment(editGymId).map((eq) => (
                      <div
                        key={eq.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        data-testid={`equipment-item-${eq.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Dumbbell className="w-4 h-4 text-primary" />
                          <span className="text-sm text-foreground">{eq.equipmentName}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteEquipmentMutation.mutate(eq.id)}
                          disabled={deleteEquipmentMutation.isPending}
                          data-testid={`button-delete-equipment-${eq.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Ingen utrustning ännu. Klicka på "Lägg till" för att börja.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditGymId(null)}
                    data-testid="button-cancel-edit"
                  >
                    Stäng
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveGym}
                    disabled={updateGymMutation.isPending}
                    data-testid="button-save-gym"
                  >
                    {updateGymMutation.isPending ? "Sparar..." : "Spara"}
                  </Button>
                </div>
                
                {editGymId && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setGymToDelete(editGymId);
                      setDeleteConfirmOpen(true);
                    }}
                    disabled={deleteGymMutation.isPending}
                    data-testid="button-delete-gym-edit"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteGymMutation.isPending ? "Raderar..." : "Radera Gym"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setScannerOpen(true)}
                className="w-full"
                data-testid="button-scan-equipment-edit"
              >
                <Dumbbell className="w-4 h-4 mr-2" />
                Skanna Utrustning
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Eller välj manuellt</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {equipmentOptions.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => toggleEditEquipment(eq)}
                    className={`p-3 rounded-lg border text-left text-sm hover-elevate active-elevate-2 relative ${
                      editSelectedEquipment.includes(eq)
                        ? "bg-primary/10 border-primary"
                        : "bg-card border-card-border"
                    }`}
                    data-testid={`edit-equipment-${eq.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {eq}
                    {editSelectedEquipment.includes(eq) && (
                      <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditEquipmentSelectorOpen(false);
                    setEditSelectedEquipment([]);
                  }}
                  data-testid="button-cancel-add-equipment"
                >
                  Avbryt
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddEquipmentToEditGym}
                  disabled={editSelectedEquipment.length === 0 || addEquipmentMutation.isPending}
                  data-testid="button-confirm-add-equipment"
                >
                  Lägg till ({editSelectedEquipment.length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EquipmentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onEquipmentDetected={editGymId ? handleEquipmentDetectedForEdit : handleEquipmentDetected}
      />

      <AlertDialog 
        open={deleteConfirmOpen} 
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            // Clear gymToDelete when dialog is closed (cancel or ESC)
            setGymToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill radera detta gym? All utrustning kommer också raderas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!gymToDelete) return; // Guard against null
                deleteGymMutation.mutate(gymToDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Radera Gym
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
