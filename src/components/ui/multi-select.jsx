import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MultiSelect({ options = [], value = [], onChange, placeholder = "Todos", label }) {
  const [open, setOpen] = useState(false);

  const toggle = (val) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const labelFor = (val) => options.find((o) => o.value === val)?.label || val;
  const summary = value.length === 0 ? placeholder : value.length <= 2 ? value.map(labelFor).join(", ") : `${value.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal h-9", value.length > 0 && "text-foreground")}
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>{summary}</span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-[280px] overflow-y-auto" align="start">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Sem opções disponíveis</p>
        ) : (
          options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate">{opt.label}</span>
                {checked && <Check className="w-3.5 h-3.5 ml-auto text-brand" />}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}