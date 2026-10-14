import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

export default function AutorizacaoAssinatura({ checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(!!value)} />
      Autorizado
    </label>
  );
}