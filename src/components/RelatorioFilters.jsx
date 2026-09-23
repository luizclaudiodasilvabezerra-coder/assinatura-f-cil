import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, X, Search, Loader2 } from "lucide-react";
import MultiSelect from "@/components/ui/multi-select";

const STATUS_OPCOES = [
  { value: "pendente_diretoria", label: "Pendente diretoria" },
  { value: "assinado_gestao", label: "Assinado gestao" },
  { value: "assinado_diretoria", label: "Assinado diretoria" },
];

const CATEGORIA_OPCOES = [
  { value: "notas_boletos", label: "Notas e Boletos" },
  { value: "abastecimento", label: "Abastecimento" },
];

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
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <MultiSelect
            options={CATEGORIA_OPCOES}
            value={filtros.categoria || []}
            onChange={(v) => upd("categoria", v)}
            placeholder="Todas"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <MultiSelect
            options={STATUS_OPCOES}
            value={filtros.status || []}
            onChange={(v) => upd("status", v)}
            placeholder="Todos"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unidade de negócio</Label>
          <MultiSelect
            options={opcoes.unidades.map((u) => ({ value: u, label: u }))}
            value={filtros.unidade || []}
            onChange={(v) => upd("unidade", v)}
            placeholder="Todas"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Gestor</Label>
          <MultiSelect
            options={opcoes.gestores.map((g) => ({ value: g, label: g }))}
            value={filtros.gestor || []}
            onChange={(v) => upd("gestor", v)}
            placeholder="Todos"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Diretoria</Label>
          <MultiSelect
            options={opcoes.diretorias.map((d) => ({ value: d, label: d }))}
            value={filtros.diretoria || []}
            onChange={(v) => upd("diretoria", v)}
            placeholder="Todas"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Número da NF</Label>
          <Input
            type="text"
            value={filtros.numeroNf || ""}
            onChange={(e) => upd("numeroNf", e.target.value)}
            placeholder="Buscar por número"
          />
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