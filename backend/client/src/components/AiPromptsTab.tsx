import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Cpu, Sparkles, Plus, Trash2, Check, RefreshCw, AlertCircle } from "lucide-react";

type AiPrompt = {
  id: string;
  name: string;
  version: string;
  role: string;
  promptType: string;
  content: string;
  isActive: boolean;
  description: string | null;
  updatedAt: string;
};

export default function AiPromptsTab() {
  const { toast } = useToast();
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);

  const { data: prompts, isLoading, isError } = useQuery<AiPrompt[]>({
    queryKey: ["/api/admin/prompts"],
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<AiPrompt>) => {
      const res = await apiRequest("POST", "/api/admin/prompts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      setEditingPrompt(null);
      toast({ title: "Prompt sparad" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Kunde inte spara prompt", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompts"] });
      toast({ title: "Prompt borttagen" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-destructive">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="font-semibold">Kunde inte hämta Prompter</p>
      </div>
    );
  }

  const v4Prompts = prompts?.filter(p => p.version === "v4") || [];
  const v4_5Prompts = prompts?.filter(p => p.version === "v4.5") || [];
  const otherPrompts = prompts?.filter(p => p.version !== "v4" && p.version !== "v4.5") || [];

  const renderPromptGrid = (title: string, items: AiPrompt[]) => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Cpu className="w-5 h-5 text-primary" />
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((prompt) => (
          <Card key={prompt.id} className={`admin-card transition-all duration-300 ${prompt.isActive ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{prompt.name}</CardTitle>
                  <CardDescription className="text-xs">{prompt.role}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={prompt.isActive}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        upsertMutation.mutate({ ...prompt, isActive: true });
                      }
                    }}
                  />
                  <Badge variant={prompt.isActive ? "default" : "outline"} className="text-[10px]">
                    {prompt.isActive ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 p-2 rounded text-[10px] font-mono h-24 overflow-hidden mask-fade-bottom">
                {prompt.content}
              </div>
              <div className="flex justify-between gap-2 mt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingPrompt(prompt)}>
                   Redigera
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => confirm("Ta bort prompt?") && deleteMutation.mutate(prompt.id)}>
                   <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card 
          className="admin-card border-dashed flex flex-col items-center justify-center py-10 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setEditingPrompt({
            id: `new-${Date.now()}`,
            name: "Ny Prompt",
            version: title === "V4" ? "v4" : title === "V4.5" ? "v4.5" : "v5",
            role: title === "V4" ? "v4-system" : title === "V4.5" ? "v4.5-system" : "new-role",
            promptType: "system",
            content: "",
            isActive: false,
            description: "",
            updatedAt: new Date().toISOString()
          } as AiPrompt)}
        >
          <Plus className="w-10 h-10 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Lägg till ny prompt sektion</p>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      {renderPromptGrid("V4", v4Prompts)}
      {renderPromptGrid("V4.5", v4_5Prompts)}
      {renderPromptGrid("Framtida / Övriga", otherPrompts)}

      <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <CardTitle>Redigera AI-Prompt</CardTitle>
            <CardDescription>Anpassa instruktionerna för din AI-modell.</CardDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Namn</label>
                <Input 
                  value={editingPrompt?.name || ""} 
                  onChange={(e) => setEditingPrompt(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Version (t.ex. v4)</label>
                <Input 
                  value={editingPrompt?.version || ""} 
                  onChange={(e) => setEditingPrompt(prev => prev ? { ...prev, version: e.target.value } : null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Roll (t.ex. v4-system)</label>
                <Input 
                  value={editingPrompt?.role || ""} 
                  onChange={(e) => setEditingPrompt(prev => prev ? { ...prev, role: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Typ (system/user/analysis)</label>
                <Input 
                  value={editingPrompt?.promptType || ""} 
                  onChange={(e) => setEditingPrompt(prev => prev ? { ...prev, promptType: e.target.value } : null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Innehåll</label>
              <Textarea 
                className="min-h-[400px] font-mono text-xs leading-relaxed"
                value={editingPrompt?.content || ""} 
                onChange={(e) => setEditingPrompt(prev => prev ? { ...prev, content: e.target.value } : null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="is_active_prompt"
                checked={editingPrompt?.isActive || false}
                onCheckedChange={(checked) => setEditingPrompt(prev => prev ? { ...prev, isActive: !!checked } : null)}
              />
              <label htmlFor="is_active_prompt" className="text-sm font-medium">Markera som aktiv för denna roll</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPrompt(null)}>Avbryt</Button>
            <Button onClick={() => editingPrompt && upsertMutation.mutate(editingPrompt)}>Spara ändringar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
