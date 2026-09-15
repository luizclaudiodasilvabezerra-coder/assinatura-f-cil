import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X, Search, Loader2 } from "lucide-react";

export default function RelatorioFilters({ filtros, setFiltros, opcoes, onLimpar, onBuscar, loading }) {
  const upd = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <Button variant="ghost" size="sm" onClick={onLimpar} className="gap-1 text-xs">
          <X className="w-3.5 h-3.5" /> Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período — de</Label>
          <Input type="date" value={filtros.dataDe} onChange={(e) => upd("dataDe", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período — até</Label>
          <Input type="date" value={filtros.dataAte} onChange={(e) => upd("dataAte", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filtros.status || "all"} onValueChange={(v) => upd("status", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente_diretoria">Pendente diretoria</SelectItem>
              <SelectItem value="assinado_gestao">Assinado gestao</SelectItem>
              <SelectItem value="assinado_diretoria">Assinado diretoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unidade de negócio</Label>
          <Select value={filtros.unidade || "all"} onValueChange={(v) => upd("unidade", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {opcoes.unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Gestor</Label>
          <Select value={filtros.gestor || "all"} onValueChange={(v) => upd("gestor", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {opcoes.gestores.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Diretoria</Label>
          <Select value={filtros.diretoria || "all"} onValueChange={(v) => upd("diretoria", v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {opcoes.diretorias.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={onBuscar} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </Button>
      </div>
    </div>
  );
}