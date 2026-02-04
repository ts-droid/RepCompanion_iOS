import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Search, Plus, Edit, Trash2, Check, RefreshCw, AlertCircle, Database, Users, Dumbbell, MapPin, GitMerge, Cpu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
// ... imports
import AiPromptsTab from "@/components/AiPromptsTab";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Exercise, EquipmentCatalog, Gym, UnmappedExercise } from "@shared/schema";
import { useLocation } from "wouter";
import "@/admin.css";

type EnhancedExercise = Exercise & { aliases?: string[] };
type EnhancedEquipment = EquipmentCatalog & { aliases?: { id: string; alias: string; lang: string }[] };
type EnhancedGym = Gym & { equipmentCount?: number; equipment?: { name: string; key: string | null }[]; userEmail?: string };

const suggestId = (name: string) => {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Editing state
  const [editingEx, setEditingEx] = useState<EnhancedExercise | null>(null);
  const [editingEq, setEditingEq] = useState<EnhancedEquipment | null>(null);
  const [editingGym, setEditingGym] = useState<EnhancedGym | null>(null);
  const [mappingUnmapped, setMappingUnmapped] = useState<UnmappedExercise | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [masterId, setMasterId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newExData, setNewExData] = useState({
    nameEn: "",
    category: "strength",
    exerciseId: "",
    difficulty: "beginner",
    primaryMuscles: [] as string[],
    requiredEquipment: [] as string[]
  });
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false);
  const [newEqData, setNewEqData] = useState({
    name: "",
    nameEn: "",
    category: "machine",
    equipmentKey: ""
  });

  const toggleId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSelectedIds([]);
  };

  // Queries
  const { data: versionData } = useQuery<{ version: string }>({
    queryKey: ["/api/version"],
  });

  const { data: stats, isError: isStatsError, error: statsError } = useQuery<{ usersCount: number }>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const { data: unmapped, isError: isUnmappedError, error: unmappedError } = useQuery<UnmappedExercise[]>({
    queryKey: ["/api/admin/unmapped-exercises"],
    retry: false,
  });

  const { data: exercises, isError: isExercisesError, error: exercisesError } = useQuery<EnhancedExercise[]>({
    queryKey: ["/api/admin/exercises"],
    retry: false,
  });

  const { data: equipment, isError: isEquipmentError, error: equipmentError } = useQuery<EnhancedEquipment[]>({
    queryKey: ["/api/admin/equipment"],
    retry: false,
  });

  const { data: gyms, isError: isGymsError, error: gymsError } = useQuery<Gym[]>({
    queryKey: ["/api/admin/gyms"],
    retry: false,
  });

  const { data: adminUsers, isError: isUsersError } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Handle 401 errors
  const anyError: any = statsError || unmappedError || exercisesError || equipmentError || gymsError;
  if (anyError && anyError.status === 401) {
    setLocation("/admin/login");
  }

  // Mutations
  const updateExerciseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Exercise> }) => {
      const res = await apiRequest("PUT", `/api/admin/exercises/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      setEditingEx(null);
      toast({ title: "Övning uppdaterad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte uppdatera övning", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EquipmentCatalog> }) => {
      const res = await apiRequest("PUT", `/api/admin/equipment/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      setEditingEq(null);
      toast({ title: "Utrustning uppdaterad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte uppdatera utrustning", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/equipment", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      setIsCreatingEquipment(false);
      setNewEqData({
        name: "",
        nameEn: "",
        category: "machine",
        equipmentKey: ""
      });
      toast({ title: "Utrustning skapad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte skapa utrustning", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateGymMutation = useMutation({
    mutationFn: async ({ id, data, equipmentKeys }: { id: string; data: Partial<Gym>; equipmentKeys?: string[] }) => {
      const res = await apiRequest("PUT", `/api/admin/gyms/${id}`, { ...data, equipmentKeys });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gyms"] });
      setEditingGym(null);
      toast({ title: "Gym uppdaterat" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte uppdatera gym", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: "Användare uppdaterad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte uppdatera användare", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createExerciseMutation = useMutation({
    mutationFn: async (data: Partial<Exercise>) => {
      const res = await apiRequest("POST", "/api/admin/exercises", data);
      return res.json();
    },
    onSuccess: (newEx) => {
      // After creating the exercise, create the alias automatically
      if (mappingUnmapped) {
        createAliasMutation.mutate({
          exerciseId: newEx.exerciseId || newEx.id,
          alias: mappingUnmapped.aiName,
          lang: 'sv'
        });
        
        // Also delete the unmapped exercise record
        deleteMutation.mutate({ type: 'unmapped-exercises', id: mappingUnmapped.id });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      setIsCreatingNew(false);
      toast({ title: "Ny övning skapad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte skapa övning", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'exercises' | 'equipment' | 'gyms' | 'unmapped-exercises' | 'users'; id: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/${type}/${id}`, undefined);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      toast({ 
        title: `${
          variables.type === 'exercises' ? 'Övning' : 
          variables.type === 'equipment' ? 'Utrustning' : 
          variables.type === 'gyms' ? 'Gym' : 
          variables.type === 'users' ? 'Användare' :
          'Omatchad övning'
        } borttagen` 
      });
    },
  });

  const createAliasMutation = useMutation({
    mutationFn: async (data: { exerciseId: string; alias: string; lang: string }) => {
      const res = await apiRequest("POST", "/api/admin/exercise-aliases", {
        ...data,
        source: 'admin'
      });
      return res.json();
    },
    onSuccess: () => {
      // If we were mapping an unmapped exercise, delete it now
      if (mappingUnmapped) {
        deleteMutation.mutate({ type: 'unmapped-exercises', id: mappingUnmapped.id });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unmapped-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] }); // Refresh so we see new aliases
      setMappingUnmapped(null);
      setNewAlias("");
      toast({ title: "Alias skapat och övning kopplad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte skapa alias", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createEquipmentAliasMutation = useMutation({
    mutationFn: async (data: { equipmentKey: string; alias: string; lang: string }) => {
      const res = await apiRequest("POST", "/api/admin/equipment-aliases", {
        ...data,
        source: 'admin'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      setNewAlias("");
      toast({ title: "Utrustningsalias skapat" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte skapa alias", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteEquipmentAliasMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/equipment-aliases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/equipment"] });
      toast({ title: "Alias borttaget" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ type, ids }: { type: 'exercises' | 'equipment' | 'gyms' | 'unmapped-exercises' | 'users'; ids: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/${type}/delete-batch`, { ids });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      setSelectedIds([]);
      toast({ 
        title: `${idsInSwedish(variables.type)} borttagna`,
        description: `${variables.ids.length} objekt raderades.`
      });
    },
  });

  const mergeExercisesMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string, targetId: string }) => {
      const res = await apiRequest("POST", "/api/admin/exercises/merge", { sourceId, targetId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exercises"] });
      setShowMergeDialog(false);
      setSelectedIds([]);
      toast({ title: "Övningar sammanslagna" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte slå samman övningar", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  function idsInSwedish(type: string) {
    switch (type) {
      case 'exercises': return 'Övningar';
      case 'equipment': return 'Utrustning';
      case 'gyms': return 'Gym';
      case 'unmapped-exercises': return 'Omatchade övningar';
      case 'users': return 'Användare';
      default: return 'Objekt';
    }
  }

  // Filtering
  const filteredExercises = exercises?.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ex.nameEn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold admin-header">Admin Dashboard</h1>
              {versionData?.version && (
                <Badge variant="outline" className="text-[10px] py-0 h-5 font-mono opacity-70">
                  v{versionData.version}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Hantera RepCompanion databas och system</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 animate-admin-fade">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto gap-2 p-1 border rounded-xl glass-panel">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">Översikt</TabsTrigger>
            <TabsTrigger value="unmapped" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300 relative">
              Omatchade
              {unmapped && unmapped.length > 0 && (
                <Badge variant="destructive" className="ml-2 absolute -top-2 -right-2 text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full shadow-lg border-2 border-background animate-pulse">
                  {unmapped.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="exercises" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">Övningar</TabsTrigger>
            <TabsTrigger value="equipment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">Utrustning</TabsTrigger>
            <TabsTrigger value="gyms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">Gym</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">Användare</TabsTrigger>
            <TabsTrigger value="prompts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all duration-300">AI-Prompter</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="animate-admin-fade delay-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="admin-card stat-card-gradient">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Totalt antal användare</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold leading-tight tabular-nums">{stats?.usersCount || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">+12% denna vecka</p>
                </CardContent>
              </Card>
              <Card className="admin-card stat-card-gradient">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Övningar i katalog</CardTitle>
                  <Database className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold leading-tight tabular-nums">{exercises?.length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Växande katalog</p>
                </CardContent>
              </Card>
              <Card className="admin-card stat-card-gradient border-destructive/20 bg-destructive/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Väntande matchningar</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive leading-tight tabular-nums">{unmapped?.length || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Kräver uppmärksamhet</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="animate-admin-fade">
            <AiPromptsTab />
          </TabsContent>

          <TabsContent value="unmapped" className="animate-admin-fade">
            <Card className="admin-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Omatchade övningar
                </CardTitle>
                <CardDescription>Övningar som AI:n föreslagit men som saknar koppling i databasen</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-muted/10 border-b flex justify-between items-center h-16">
                  <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                      <>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                          {selectedIds.length} markerade
                        </span>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => confirm(`Ta bort ${selectedIds.length} omatchade övningar?`) && bulkDeleteMutation.mutate({ type: 'unmapped-exercises', ids: selectedIds })}
                          className="hover-elevate"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Radera markerade
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={unmapped && unmapped.length > 0 && unmapped.every(i => selectedIds.includes(i.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allIds = unmapped?.map(i => i.id) || [];
                              setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
                            } else {
                              const allIds = unmapped?.map(i => i.id) || [];
                              setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>AI Namn</TableHead>
                      <TableHead>Kategori / Muskler</TableHead>
                      <TableHead>Utrustning</TableHead>
                      <TableHead>Antal</TableHead>
                      <TableHead>Senast sedd</TableHead>
                      <TableHead className="text-right">Åtgärd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmapped?.map((item) => (
                      <TableRow key={item.id} className="admin-table-row">
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={() => toggleId(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          <div>{item.aiName}</div>
                          {item.difficulty && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 mt-1 font-normal opacity-70">
                              {item.difficulty}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium capitalize">{item.category || "-"}</span>
                            <div className="flex flex-wrap gap-1">
                              {item.primaryMuscles?.slice(0, 3).map((m: string, i: number) => (
                                <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{m}</span>
                              ))}
                              {item.primaryMuscles && item.primaryMuscles.length > 3 && <span className="text-[10px] text-muted-foreground">+{item.primaryMuscles.length - 3}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {item.equipment?.slice(0, 2).map((e: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[9px] px-1 h-4">{e}</Badge>
                            ))}
                            {item.equipment && item.equipment.length > 2 && <span className="text-[9px] text-muted-foreground">+{item.equipment.length - 2}</span>}
                            {(!item.equipment || item.equipment.length === 0) && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-background text-xs">{item.count} st</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[10px]">{new Date(item.lastSeen).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => {
                              setMappingUnmapped(item);
                              setIsCreatingNew(false);
                              setNewAlias("");
                               setNewExData({
                                nameEn: item.aiName,
                                category: item.category || "strength",
                                exerciseId: suggestId(item.aiName),
                                difficulty: item.difficulty || "beginner",
                                primaryMuscles: item.primaryMuscles || [],
                                requiredEquipment: item.equipment || []
                              });
                            }} className="hover-elevate">
                              <Check className="w-4 h-4 mr-2" /> Matcha
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => confirm("Ta bort omatchad övning?") && deleteMutation.mutate({ type: 'unmapped-exercises', id: item.id })}
                              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                     {!unmapped && !isUnmappedError && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-muted-foreground">Hämtar omatchade övningar...</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {isUnmappedError && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-destructive">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p className="font-semibold">Kunde inte hämta data</p>
                          <p className="text-xs opacity-70">{(unmappedError as any)?.message || "Okänt fel"}</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {unmapped && unmapped.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Check className="w-8 h-8 text-primary" />
                            <p>Inga omatchade övningar just nu!</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercises" className="animate-admin-fade">
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4 bg-muted/20 p-4 rounded-xl border glass-panel">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Sök övningar..." 
                        className="h-9 w-64 bg-background"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 h-9">
                      <Checkbox 
                        id="showTranslationsEx" 
                        checked={showTranslations}
                        onCheckedChange={(checked) => setShowTranslations(!!checked)}
                      />
                      <label htmlFor="showTranslationsEx" className="text-xs font-medium cursor-pointer select-none">
                        Visa översättningar
                      </label>
                    </div>
                  </div>
                <Button className="hover-elevate shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Ny övning
                </Button>
              </div>

              <Card className="admin-card overflow-hidden">
                <div className="p-4 bg-muted/10 border-b flex justify-between items-center h-16">
                  <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                      <>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                          {selectedIds.length} markerade
                        </span>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => confirm(`Ta bort ${selectedIds.length} övningar?`) && bulkDeleteMutation.mutate({ type: 'exercises', ids: selectedIds })}
                          className="hover-elevate"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Radera markerade
                        </Button>
                        {selectedIds.length === 2 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowMergeDialog(true)}
                            className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 ml-2"
                          >
                            <GitMerge className="w-4 h-4 mr-2" /> Slå samman
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                         <TableHead className="w-12">
                           <Checkbox 
                             checked={filteredExercises && filteredExercises.length > 0 && filteredExercises.every(i => selectedIds.includes(i.id))}
                             onCheckedChange={(checked) => {
                               const sliceIds = filteredExercises?.map(i => i.id) || [];
                               if (checked) {
                                 setSelectedIds(prev => Array.from(new Set([...prev, ...sliceIds])));
                               } else {
                                 setSelectedIds(prev => prev.filter(id => !sliceIds.includes(id)));
                               }
                             }}
                           />
                         </TableHead>
                         <TableHead className="w-[120px]">V4 ID</TableHead>
                        <TableHead>Namn (EN)</TableHead>
                        {showTranslations && <TableHead>Namn (SV)</TableHead>}
                        <TableHead>Kategori</TableHead>
                        <TableHead>Utrustning</TableHead>
                        <TableHead>Video</TableHead>
                        <TableHead className="text-right">Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExercises?.map((ex) => (
                        <TableRow key={ex.id} className="admin-table-row">
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.includes(ex.id)}
                              onCheckedChange={() => toggleId(ex.id)}
                            />
                          </TableCell>
                           <TableCell className="text-xs font-mono">
                             {ex.exerciseId ? (
                               <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{ex.exerciseId}</Badge>
                             ) : (
                               <Badge variant="destructive" className="animate-pulse">SAKNAS!</Badge>
                             )}
                           </TableCell>
                          <TableCell className="font-semibold">
                            <div className="flex flex-col">
                              <span>{ex.nameEn || ex.name}</span>
                              {ex.aliases && ex.aliases.length > 0 && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  Alias: {ex.aliases.join(", ")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {showTranslations && <TableCell className="text-muted-foreground">{ex.name || "-"}</TableCell>}
                          <TableCell>
                            <Badge variant="secondary" className="font-normal capitalize">{ex.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {ex.requiredEquipment?.map((eq, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4">{eq}</Badge>
                              )) || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {ex.youtubeUrl ? (
                              <a 
                                href={ex.youtubeUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs flex items-center gap-1"
                              >
                                Länk
                              </a>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditingEx(ex)} className="hover:bg-primary/10 hover:text-primary transition-colors">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => confirm("Ta bort övning?") && deleteMutation.mutate({ type: 'exercises', id: ex.id })} className="hover:bg-destructive/10 hover:text-destructive flex items-center h-8 w-8 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!filteredExercises && !isExercisesError && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-20">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-muted-foreground">Hämtar övningar...</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {isExercisesError && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-destructive">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p className="font-semibold">Kunde inte hämta övningar</p>
                          <p className="text-xs opacity-70">{(exercisesError as any)?.message || "Okänt fel"}</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredExercises && filteredExercises.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <AlertCircle className="w-8 h-8 text-muted-foreground" />
                            <p>Inga övningar hittades.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="animate-admin-fade">
             <Card className="admin-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-3">
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  Utrustningskatalog
                </CardTitle>
                <Button size="sm" onClick={() => setIsCreatingEquipment(true)} className="hover-elevate">
                  <Plus className="w-4 h-4 mr-2" /> Lägg till utrustning
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-muted/10 border-b flex justify-between items-center h-16">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 h-9">
                      <Checkbox 
                        id="showTranslationsEq" 
                        checked={showTranslations}
                        onCheckedChange={(checked) => setShowTranslations(!!checked)}
                      />
                      <label htmlFor="showTranslationsEq" className="text-xs font-medium cursor-pointer select-none">
                        Visa översättningar
                      </label>
                    </div>
                    {selectedIds.length > 0 && (
                      <>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                          {selectedIds.length} markerade
                        </span>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => confirm(`Ta bort ${selectedIds.length} utrustningsposter?`) && bulkDeleteMutation.mutate({ type: 'equipment', ids: selectedIds })}
                          className="hover-elevate"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Radera markerade
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={equipment && equipment.length > 0 && equipment.every(i => selectedIds.includes(i.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allIds = equipment?.map(i => i.id) || [];
                              setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
                            } else {
                              const allIds = equipment?.map(i => i.id) || [];
                              setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Namn (EN)</TableHead>
                      {showTranslations && <TableHead>Namn (SV)</TableHead>}
                      <TableHead>Kategori</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead className="text-right">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment?.map((eq) => (
                      <TableRow key={eq.id} className="admin-table-row">
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(eq.id)}
                            onCheckedChange={() => toggleId(eq.id)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          <div className="flex flex-col">
                            <span>{eq.nameEn || eq.name}</span>
                            {eq.aliases && eq.aliases.length > 0 && (
                              <span className="text-[10px] text-muted-foreground italic">
                                Alias: {eq.aliases.map(a => a.alias).join(", ")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {showTranslations && <TableCell className="text-muted-foreground">{eq.name || "-"}</TableCell>}
                        <TableCell><Badge variant="outline" className="capitalize">{eq.category}</Badge></TableCell>
                        <TableCell className="text-xs font-mono">{eq.equipmentKey}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditingEq(eq)} className="hover:bg-primary/10 hover:text-primary transition-colors">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => confirm("Ta bort utrustning?") && deleteMutation.mutate({ type: 'equipment', id: eq.id })} className="hover:bg-destructive/10 hover:text-destructive flex items-center h-8 w-8 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!equipment && !isEquipmentError && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-muted-foreground">Hämtar utrustning...</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {isEquipmentError && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-destructive">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p className="font-semibold">Kunde inte hämta utrustning</p>
                          <p className="text-xs opacity-70">{(equipmentError as any)?.message || "Okänt fel"}</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {equipment && equipment.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <AlertCircle className="w-8 h-8 text-muted-foreground" />
                            <p>Ingen utrustning hittades.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gyms" className="animate-admin-fade">
             <Card className="admin-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Alla registrerade gym
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-muted/10 border-b flex justify-between items-center h-16">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5 h-9">
                      <Checkbox 
                        id="showTranslationsEq" 
                        checked={showTranslations}
                        onCheckedChange={(checked) => setShowTranslations(!!checked)}
                      />
                      <label htmlFor="showTranslationsEq" className="text-xs font-medium cursor-pointer select-none">
                        Visa översättningar
                      </label>
                    </div>
                    {selectedIds.length > 0 && (
                      <>
                        <span className="text-sm font-medium text-muted-foreground mr-2">
                          {selectedIds.length} markerade
                        </span>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => confirm(`Ta bort ${selectedIds.length} gym?`) && bulkDeleteMutation.mutate({ type: 'gyms', ids: selectedIds })}
                          className="hover-elevate"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Radera markerade
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={gyms && gyms.length > 0 && gyms.every(i => selectedIds.includes(i.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const allIds = gyms?.map(i => i.id) || [];
                              setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
                            } else {
                              const allIds = gyms?.map(i => i.id) || [];
                              setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Namn</TableHead>
                      <TableHead>Plats / Adress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Utrustning</TableHead>
                      <TableHead>Användare</TableHead>
                      <TableHead className="text-right">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gyms?.map((gym: any) => (
                      <TableRow key={gym.id} className="admin-table-row">
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(gym.id)}
                            onCheckedChange={() => toggleId(gym.id)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{gym.name}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{gym.location || "Ej angivet"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {gym.isPublic && (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 bg-emerald-50/50">
                                Publik
                              </Badge>
                            )}
                            {gym.isVerified && (
                              <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600 bg-blue-50/50">
                                <Check className="w-3 h-3 mr-0.5" /> Verifierad
                              </Badge>
                            )}
                            {!gym.isPublic && !gym.isVerified && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground opacity-50">
                                Privat
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {gym.equipmentCount || 0} st
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{gym.userEmail || "Ingen ägare"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditingGym(gym)} className="hover:bg-primary/10 hover:text-primary transition-colors">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => confirm("Ta bort gym?") && deleteMutation.mutate({ type: 'gyms', id: gym.id })} className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 flex items-center transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!gyms && !isGymsError && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                          <p className="text-muted-foreground">Hämtar gym...</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {isGymsError && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-destructive">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                          <p className="font-semibold">Kunde inte hämta gym</p>
                          <p className="text-xs opacity-70">{(gymsError as any)?.message || "Okänt fel"}</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {gyms && gyms.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <AlertCircle className="w-8 h-8 text-muted-foreground" />
                            <p>Inga gym hittades.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="animate-admin-fade delay-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Användare</h2>
                  <Badge variant="secondary">{adminUsers?.length || 0}</Badge>
                </div>
                {selectedIds.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      if (confirm(`Är du säker på att du vill ta bort ${selectedIds.length} användare? Detta går inte att ångra.`)) {
                        bulkDeleteMutation.mutate({ type: 'users', ids: selectedIds });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Ta bort markerade ({selectedIds.length})
                  </Button>
                )}
              </div>

              <Card className="admin-card overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={adminUsers && adminUsers.length > 0 && adminUsers.every(u => selectedIds.includes(u.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const allIds = adminUsers?.map(u => u.id) || [];
                                setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
                              } else {
                                const allIds = adminUsers?.map(u => u.id) || [];
                                setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Namn</TableHead>
                        <TableHead>Skapad</TableHead>
                        <TableHead>Senast aktiv</TableHead>
                        <TableHead className="text-right">Åtgärder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers?.map((user: any) => (
                        <TableRow key={user.id} className="admin-table-row">
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.includes(user.id)}
                              onCheckedChange={() => toggleId(user.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.email || user.username}</span>
                              {user.isPremium && (
                                <Badge variant="outline" className="w-fit text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 mt-0.5">Premium</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{user.displayName || user.profile?.displayName || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                             {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : (user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "-")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)} className="hover:bg-primary/10 hover:text-primary transition-colors">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => confirm("Ta bort användare? Detta går inte att ångra.") && deleteMutation.mutate({ type: 'users', id: user.id })} className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 flex items-center transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!adminUsers && !isUsersError && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                            <p className="text-muted-foreground">Hämtar användare...</p>
                          </TableCell>
                        </TableRow>
                      )}
                      {adminUsers?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <p className="text-muted-foreground">Inga användare hittades.</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Matching Dialog */}
      <Dialog open={!!mappingUnmapped} onOpenChange={() => setMappingUnmapped(null)}>
        <DialogContent className="admin-dialog-top">
          <DialogHeader>
            <DialogTitle>{isCreatingNew ? "Skapa ny övning" : "Matcha AI-övning"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="sticky-proposal">
              <p className="text-sm font-medium">AI föreslog:</p>
              <p className="text-lg font-bold">{mappingUnmapped?.aiName}</p>
            </div>
            
            {!isCreatingNew ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Välj befintlig övning att koppla till:</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
                    onChange={(e) => setNewAlias(e.target.value)}
                    value={newAlias}
                  >
                    <option value="">Välj övning...</option>
                    {exercises?.sort((a, b) => (a.nameEn || a.name).localeCompare(b.nameEn || b.name)).map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.nameEn || ex.name} 
                        {ex.nameEn && ex.nameEn !== ex.name ? ` (${ex.name})` : ""}
                        {ex.exerciseId ? ` [${ex.exerciseId}]` : " (Saknar V4 ID!)"}
                      </option>
                    ))}
                  </select>
                </div>
                {newAlias && !exercises?.find(e => e.id === newAlias)?.exerciseId && (
                  <div className="space-y-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 animate-in fade-in zoom-in-95">
                    <label className="text-xs font-bold text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> KRÄVER V4 ID: Denna övning saknar ID!
                    </label>
                    <Input 
                      placeholder="t.ex. dips_assisted"
                      className="h-8 text-xs border-destructive/30 focus-visible:ring-destructive"
                      value={newExData.exerciseId}
                      onChange={(e) => setNewExData(prev => ({ ...prev, exerciseId: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Ange ett unikt ID för att kunna matcha övningen.
                    </p>
                  </div>
                )}
                <div className="flex flex-col items-center gap-2 pt-2 border-t mt-4">
                  <p className="text-xs text-muted-foreground">Hittar du inte övningen?</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    setIsCreatingNew(true);
                     setNewExData({
                      nameEn: mappingUnmapped?.aiName || "",
                      category: "strength",
                      exerciseId: suggestId(mappingUnmapped?.aiName || ""),
                      difficulty: "beginner",
                      primaryMuscles: [],
                      requiredEquipment: []
                    });
                  }}>
                    <Plus className="w-4 h-4 mr-2" /> Skapa som ny övning
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Namn (EN)</label>
                  <Input 
                    value={newExData.nameEn} 
                    onChange={(e) => setNewExData(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="Engelskt namn för katalogen"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">V4 Exercise ID (t.ex. bench_press)</label>
                  <Input 
                    value={newExData.exerciseId} 
                    onChange={(e) => setNewExData(prev => ({ ...prev, exerciseId: e.target.value }))}
                    placeholder="Unikt ID för systemet"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategori</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newExData.category}
                    onChange={(e) => setNewExData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="stretching">Stretching</option>
                    <option value="mobility">Mobility</option>
                  </select>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setIsCreatingNew(false)}>
                  Tillbaka till matcha befintlig
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMappingUnmapped(null);
              setIsCreatingNew(false);
            }}>Avbryt</Button>
            
            {!isCreatingNew ? (
              <Button 
                disabled={!newAlias || (exercises?.find(e => e.id === newAlias)?.exerciseId ? false : !newExData.exerciseId) || createAliasMutation.isPending || updateExerciseMutation.isPending}
                onClick={async () => {
                  if (mappingUnmapped && newAlias) {
                    const selectedEx = exercises?.find(e => e.id === newAlias);
                    
                    // If the exercise is missing an ID, update it first
                    if (selectedEx && !selectedEx.exerciseId && newExData.exerciseId) {
                      await updateExerciseMutation.mutateAsync({
                        id: selectedEx.id,
                        data: { exerciseId: newExData.exerciseId }
                      });
                    }

                    createAliasMutation.mutate({
                      exerciseId: selectedEx?.exerciseId || newExData.exerciseId || newAlias,
                      alias: mappingUnmapped.aiName,
                      lang: 'sv'
                    });
                  }
                }}
              >
                {createAliasMutation.isPending || updateExerciseMutation.isPending ? "Sparar..." : "Spara koppling"}
              </Button>
            ) : (
              <Button 
                disabled={!newExData.exerciseId || createExerciseMutation.isPending}
                onClick={() => {
                    createExerciseMutation.mutate({
                    name: mappingUnmapped?.aiName || "",
                    nameEn: newExData.nameEn,
                    category: newExData.category,
                    exerciseId: newExData.exerciseId,
                    difficulty: newExData.difficulty,
                    primaryMuscles: newExData.primaryMuscles,
                    requiredEquipment: newExData.requiredEquipment
                  } as any);
                }}
              >
                {createExerciseMutation.isPending ? "Sparar..." : "Skapa & Koppla"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Exercise Dialog */}
      <Dialog open={!!editingEx} onOpenChange={() => setEditingEx(null)}>
        <DialogContent className="admin-dialog-top md:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Redigera övning</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Namn (EN)</label>
                <Input 
                  value={editingEx?.nameEn || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, nameEn: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Namn (SV)</label>
                <Input value={editingEx?.name || ""} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">V4 Exercise ID</label>
                <Input 
                  value={editingEx?.exerciseId || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, exerciseId: e.target.value } : null)}
                  placeholder="t.ex. barbell_bench_press"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editingEx?.category || ""}
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, category: e.target.value } : null)}
                >
                  <option value="strength">Strength</option>
                  <option value="isolation">Isolation</option>
                  <option value="compound">Compound</option>
                  <option value="cardio">Cardio</option>
                  <option value="stretching">Stretching</option>
                  <option value="mobility">Mobility</option>
                  <option value="recovery">Recovery</option>
                  <option value="muscle_balance">Muscle Balance</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Svårighetsgrad</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editingEx?.difficulty || "beginner"}
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, difficulty: e.target.value } : null)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="isCompound" 
                  checked={editingEx?.isCompound || false} 
                  onCheckedChange={(checked) => setEditingEx(prev => prev ? { ...prev, isCompound: !!checked } : null)}
                />
                <label htmlFor="isCompound" className="text-sm font-medium leading-none cursor-pointer">
                  Flerledsövning (Compound)
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">YouTube URL</label>
                <Input 
                  value={editingEx?.youtubeUrl || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, youtubeUrl: e.target.value } : null)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Utrustning (separera med kommatecken)</label>
                <Input 
                  type="text"
                  value={editingEx?.requiredEquipment?.join(", ") || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, requiredEquipment: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : null)}
                  onKeyDown={(e) => { if (e.key === ',') e.stopPropagation(); }}
                  placeholder="barbell, bench"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Primära Muskler (kommatecken)</label>
                <Input 
                  type="text"
                  value={editingEx?.primaryMuscles?.join(", ") || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, primaryMuscles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : null)}
                  onKeyDown={(e) => { if (e.key === ',') e.stopPropagation(); }}
                  placeholder="chest, triceps"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sekundära Muskler (kommatecken)</label>
                <Input 
                  type="text"
                  value={editingEx?.secondaryMuscles?.join(", ") || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, secondaryMuscles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : null)}
                  onKeyDown={(e) => { if (e.key === ',') e.stopPropagation(); }}
                  placeholder="shoulders"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <Textarea 
                  value={editingEx?.description || ""} 
                  onChange={(e) => setEditingEx(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEx(null)}>Avbryt</Button>
            <Button onClick={() => {
              if (editingEx) {
                const { id, ...data } = editingEx;
                // Clean data: remove aliases and other non-updateable fields if necessary
                const updateData = {
                  exerciseId: data.exerciseId,
                  nameEn: data.nameEn,
                  category: data.category,
                  difficulty: data.difficulty,
                  primaryMuscles: data.primaryMuscles,
                  secondaryMuscles: data.secondaryMuscles,
                  requiredEquipment: data.requiredEquipment,
                  isCompound: data.isCompound,
                  youtubeUrl: data.youtubeUrl,
                  description: data.description,
                  videoType: data.youtubeUrl ? 'youtube' : null
                };
                updateExerciseMutation.mutate({ id, data: updateData });
              }
            }}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create Equipment Dialog */}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="admin-dialog-top md:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Redigera användare</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input 
                value={editingUser?.email || ""} 
                onChange={(e) => setEditingUser((prev: any) => prev ? { ...prev, email: e.target.value } : null)} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input 
                value={editingUser?.displayName || ""} 
                onChange={(e) => setEditingUser((prev: any) => prev ? { ...prev, displayName: e.target.value } : null)} 
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="isPremium" 
                checked={editingUser?.isPremium || false} 
                onCheckedChange={(checked) => setEditingUser((prev: any) => prev ? { ...prev, isPremium: !!checked } : null)}
              />
              <label htmlFor="isPremium" className="text-sm font-medium leading-none cursor-pointer">
                Premium-användare
              </label>
            </div>
            {editingUser?.lastActiveAt && (
              <div className="text-xs text-muted-foreground mt-4">
                Senast aktiv: {new Date(editingUser.lastActiveAt).toLocaleString()}
              </div>
            )}
           </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Avbryt</Button>
            <Button onClick={() => {
              if (editingUser) {
                const { id, profile, ...data } = editingUser;
                // Only send updateable User fields
                updateUserMutation.mutate({ id, data });
              }
            }}>Spara ändringar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Equipment Dialog */}
      <Dialog open={isCreatingEquipment} onOpenChange={setIsCreatingEquipment}>
        <DialogContent className="admin-dialog-top">
          <DialogHeader>
            <DialogTitle>Lägg till ny utrustning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Namn (EN)</label>
              <Input 
                value={newEqData.nameEn} 
                onChange={(e) => {
                  const val = e.target.value;
                  setNewEqData(prev => ({ 
                    ...prev, 
                    nameEn: val,
                    equipmentKey: suggestId(val)
                  }));
                }} 
                placeholder="t.ex. Leg Press"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Namn (SV)</label>
              <Input 
                value={newEqData.name} 
                onChange={(e) => setNewEqData(prev => ({ ...prev, name: e.target.value }))} 
                placeholder="t.ex. Benpress"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newEqData.category}
                onChange={(e) => setNewEqData(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="machine">Machine</option>
                <option value="free_weights">Free weights</option>
                <option value="bench">Benches</option>
                <option value="rack">Racks / Rigs</option>
                <option value="bodyweight">Bodyweight</option>
                <option value="accessory">Accessory</option>
                <option value="attachment">Attachment</option>
                <option value="cardio">Cardio</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment Key (V4)</label>
              <Input 
                value={newEqData.equipmentKey} 
                onChange={(e) => setNewEqData(prev => ({ ...prev, equipmentKey: e.target.value }))} 
                placeholder="t.ex. leg_press"
              />
              <p className="text-[10px] text-muted-foreground italic">
                Används för logik och AI-matchning. Bör vara gemener med understreck.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingEquipment(false)}>Avbryt</Button>
            <Button 
              onClick={() => createEquipmentMutation.mutate(newEqData)}
              disabled={!newEqData.name || !newEqData.equipmentKey || createEquipmentMutation.isPending}
            >
              {createEquipmentMutation.isPending ? "Sparar..." : "Spara utrustning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Equipment Dialog */}
      <Dialog open={!!editingEq} onOpenChange={() => {
        setEditingEq(null);
        setNewAlias("");
      }}>
        <DialogContent className="admin-dialog-top md:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Redigera utrustning</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Namn (EN)</label>
                <Input value={editingEq?.nameEn || ""} onChange={(e) => setEditingEq(prev => prev ? { ...prev, nameEn: e.target.value } : null)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Namn (SV)</label>
                <Input value={editingEq?.name || ""} onChange={(e) => setEditingEq(prev => prev ? { ...prev, name: e.target.value } : null)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Equipment Key (V4)</label>
                <Input value={editingEq?.equipmentKey || ""} onChange={(e) => setEditingEq(prev => prev ? { ...prev, equipmentKey: e.target.value } : null)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Kategori</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editingEq?.category || "machine"}
                  onChange={(e) => setEditingEq(prev => prev ? { ...prev, category: e.target.value } : null)}
                >
                  <option value="machine">Machine</option>
                  <option value="free_weights">Free weights</option>
                  <option value="bench">Benches</option>
                  <option value="rack">Racks / Rigs</option>
                  <option value="bodyweight">Bodyweight</option>
                  <option value="accessory">Accessory</option>
                  <option value="attachment">Attachment</option>
                  <option value="cardio">Cardio</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-muted-foreground/10">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-bold flex items-center gap-1">
                     <Plus className="w-3 h-3 text-primary" /> Aliases (for AI matching)
                  </label>
                  <Badge variant="outline" className="text-[9px]">EN PRIORITIZED</Badge>
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="t.ex. leg press machine" 
                    className="h-8 text-xs"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                  />
                  <Button 
                    size="sm" 
                    className="h-8 px-2"
                    disabled={!newAlias || !editingEq?.equipmentKey || createEquipmentAliasMutation.isPending}
                    onClick={() => {
                      if (editingEq?.equipmentKey) {
                        createEquipmentAliasMutation.mutate({
                          equipmentKey: editingEq.equipmentKey,
                          alias: newAlias,
                          lang: 'en'
                        });
                      }
                    }}
                  >
                    {createEquipmentAliasMutation.isPending ? "..." : <Plus className="w-3 h-3" />}
                  </Button>
                </div>

                <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar pt-1">
                  {editingEq?.aliases && editingEq.aliases.length > 0 ? (
                    editingEq.aliases.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-background/50 border rounded px-2 py-1 text-xs group">
                        <span className="truncate max-w-[150px]">{a.alias}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 uppercase opacity-50 group-hover:opacity-100">{a.lang}</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteEquipmentAliasMutation.mutate(a.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic text-center py-2">Inga alias tillagda</p>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground leading-tight italic mt-1">
                  AI-matching prioriterar engelska alias. Lägg till vanliga variationer här.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEq(null)}>Avbryt</Button>
            <Button onClick={() => {
              if (editingEq) {
                const { id, aliases, ...data } = editingEq;
                updateEquipmentMutation.mutate({ id, data });
              }
            }}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Merge Exercises Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="admin-dialog-top sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary" /> Slå samman övningar
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-primary">Master-övningen behålls och får all historik från den andra.</p>
              <p className="text-xs text-muted-foreground">Välj vilken som ska vara master:</p>
            </div>
            
            <div className="space-y-3">
              {selectedIds.map(id => {
                const ex = (exercises as EnhancedExercise[])?.find(e => e.id === id);
                if (!ex) return null;
                return (
                  <div 
                    key={id}
                    onClick={() => setMasterId(id)}
                    className={`
                      p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center group
                      ${masterId === id 
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                        : 'border-muted hover:border-muted-foreground/30 bg-muted/30'}
                    `}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold flex items-center gap-2">
                        {ex.nameEn || ex.name}
                        {ex.exerciseId && <Badge variant="outline" className="text-[9px] h-4 py-0 group-hover:bg-primary/10">{ex.exerciseId}</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{ex.name && ex.name !== ex.nameEn ? ex.name : ""}</span>
                    </div>
                    {masterId === id && <Check className="w-5 h-5 text-primary" />}
                  </div>
                );
              })}
            </div>

            {masterId && (
              <div className="text-sm p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200">
                <p className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Den andra övningen ({(exercises as EnhancedExercise[])?.find(e => selectedIds.includes(e.id) && e.id !== masterId)?.nameEn || (exercises as EnhancedExercise[])?.find(e => selectedIds.includes(e.id) && e.id !== masterId)?.name}) 
                    kommer att **raderas permanent**. All historik flyttas till {(exercises as EnhancedExercise[])?.find(e => e.id === masterId)?.nameEn || (exercises as EnhancedExercise[])?.find(e => e.id === masterId)?.name}.
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Avbryt</Button>
            <Button 
              disabled={!masterId || mergeExercisesMutation.isPending}
              onClick={() => {
                const sourceId = selectedIds.find(id => id !== masterId);
                if (sourceId && masterId) {
                  mergeExercisesMutation.mutate({ sourceId, targetId: masterId });
                }
              }}
            >
              {mergeExercisesMutation.isPending ? "Slår samman..." : "Slå samman nu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Gym Dialog */}
      <Dialog open={!!editingGym} onOpenChange={() => setEditingGym(null)}>
        <DialogContent className="admin-dialog-top md:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Redigera gym</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gymnamn</label>
                <Input 
                  value={editingGym?.name || ""} 
                  onChange={(e) => setEditingGym(prev => prev ? { ...prev, name: e.target.value } : null)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Adress / Plats</label>
                <Input 
                  value={editingGym?.location || ""} 
                  onChange={(e) => setEditingGym(prev => prev ? { ...prev, location: e.target.value } : null)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y bg-muted/10 px-3">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="isPublicGym" 
                    checked={editingGym?.isPublic || false}
                    onCheckedChange={(checked) => setEditingGym(prev => prev ? { ...prev, isPublic: !!checked } : null)}
                  />
                  <label htmlFor="isPublicGym" className="text-xs font-semibold cursor-pointer">Publikt gym</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="isVerifiedGym" 
                    checked={editingGym?.isVerified || false}
                    onCheckedChange={(checked) => setEditingGym(prev => prev ? { ...prev, isVerified: !!checked } : null)}
                  />
                  <label htmlFor="isVerifiedGym" className="text-xs font-semibold cursor-pointer">Verifierad status</label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latitude</label>
                  <Input 
                    className="h-8 text-xs font-mono"
                    value={editingGym?.latitude || ""} 
                    onChange={(e) => setEditingGym(prev => prev ? { ...prev, latitude: e.target.value } : null)}
                    placeholder="T.ex. 59.3293"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Longitude</label>
                  <Input 
                    className="h-8 text-xs font-mono"
                    value={editingGym?.longitude || ""} 
                    onChange={(e) => setEditingGym(prev => prev ? { ...prev, longitude: e.target.value } : null)}
                    placeholder="T.ex. 18.0686"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Registrerad utrustning ({editingGym?.equipmentCount || 0} st)
              </label>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {editingGym?.equipment && editingGym.equipment.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Utrustning</th>
                          <th className="text-left py-2 px-3 font-medium">V4 Key</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {editingGym.equipment.map((eq, i) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-3">{eq.name}</td>
                            <td className="py-2 px-3">
                              {eq.key ? (
                                <Badge variant="outline" className="text-[10px] font-mono">{eq.key}</Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Ingen nyckel</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-10 text-center text-muted-foreground bg-muted/10">
                      <p className="text-sm">Ingen utrustning registrerad på detta gym.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGym(null)}>Avbryt</Button>
            <Button onClick={() => {
              if (editingGym) {
                const { id, equipmentCount, equipment, userEmail, ...data } = editingGym;
                updateGymMutation.mutate({ id, data });
              }
            }}>Spara ändringar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

          