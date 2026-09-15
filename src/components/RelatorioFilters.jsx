import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";

export default function RelatorioFilters({ filtros, setFiltros, opcoes, onLimpar }) {
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
          <Label className="text-xs text-muted-foreground">Período assinatura — de</Label>
          <Input type="date" value={filtros.dataDe} onChange={(e) => upd("dataDe", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período assinatura — até</Label>
          <Input type="date" value={filtros.dataAte} onChange={(e) => upd("dataAte", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Emitente da NF</Label>
          <Input placeholder="Nome do emitente" value={filtros.emitente} onChange={(e) => upd("emitente", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Valor mínimo (R$)</Label>
          <Input type="number" min="0" step="0.01" placeholder="0,00" value={filtros.valorMin} onChange={(e) => upd("valorMin", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Valor máximo (R$)</Label>
          <Input type="number" min="0" step="0.01" placeholder="0,00" value={filtros.valorMax} onChange={(e) => upd("valorMax", e.target.value)} />
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
          <Label className="text-xs text-muted-foreground">Data de emissão da NF</Label>
          <Input type="date" value={filtros.dataEmissao} onChange={(e) => upd("dataEmissao", e.target.value)} />
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
    </div>
  );
}