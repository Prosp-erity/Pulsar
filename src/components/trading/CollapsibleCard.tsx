"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Reusable card with a header row (icon + title + subtitle + optional
 * status badge + a chevron that rotates on expand). Children render
 * inside the collapsible body. Default-open state is configurable.
 *
 * Used on the Live Trading tab (Binance / OKX / MetaAPI / MT5 Bridge
 * sections), the Risk Management screen (each risk section), and the
 * Live tab warning / "what happens when live" panels.
 */
export function CollapsibleCard({
  icon,
  title,
  subtitle,
  rightExtra,
  defaultOpen = true,
  accent = "default",
  children,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightExtra?: React.ReactNode;
  defaultOpen?: boolean;
  accent?: "default" | "amber" | "red" | "emerald" | "violet";
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentBorder =
    accent === "amber"
      ? "border-amber-500/30 bg-amber-500/5"
      : accent === "red"
        ? "border-red-500/30 bg-red-500/5"
        : accent === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : accent === "violet"
            ? "border-violet-500/30 bg-violet-500/5"
            : "";
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "glass rounded-xl p-4 sm:p-5",
        accentBorder && `border ${accentBorder}`,
        className,
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-2 text-left">
            {icon}
            <div>
              <div className="font-bold text-sm flex items-center gap-1.5">
                {title}
              </div>
              {subtitle && (
                <div className="text-[10px] text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightExtra}
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
                "group-hover:text-foreground",
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
        <div className="space-y-3 mt-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
