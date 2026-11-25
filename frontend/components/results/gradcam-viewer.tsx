"use client";

import { Columns2, Info, Layers, Minus, Plus, RotateCcw, ScanLine } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreeningImages } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "overlay" | "side" | "input";

interface View {
  zoom: number;
  x: number;
  y: number;
}

function Panel({
  label,
  view,
  onPan,
  children,
}: {
  label: string;
  view: View;
  onPan: (dx: number, dy: number) => void;
  children: React.ReactNode;
}) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  return (
    <figure className="space-y-2">
      <div
        className={cn(
          "relative aspect-square touch-none overflow-hidden rounded-2xl bg-black ring-1 ring-border select-none",
          view.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "",
        )}
        onPointerDown={(e) => {
          if (view.zoom <= 1) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onPan(e.clientX - drag.current.x, e.clientY - drag.current.y);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          className="absolute inset-0 transition-transform duration-150 ease-out"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {children}
        </div>
      </div>
      <figcaption className="text-center text-xs font-medium text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

/* eslint-disable @next/next/no-img-element -- session-only data URLs, never served by Next */
export function GradCamViewer({ images }: { images: ScreeningImages }) {
  const [mode, setMode] = useState<Mode>("overlay");
  const [opacity, setOpacity] = useState(60);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const heat = images.heatmap;

  const setZoom = (z: number) =>
    setView((v) => {
      const zoom = Math.min(4, Math.max(1, z));
      return zoom === 1 ? { zoom, x: 0, y: 0 } : { ...v, zoom };
    });
  const pan = (dx: number, dy: number) =>
    setView((v) => {
      const limit = 200 * (v.zoom - 1);
      return { ...v, x: Math.max(-limit, Math.min(limit, v.x + dx)), y: Math.max(-limit, Math.min(limit, v.y + dy)) };
    });

  const original = <img src={images.display} alt="Retina photo (cropped and resized)" className="absolute inset-0 size-full" draggable={false} />;
  const heatOnly = heat && <img src={heat} alt="Grad-CAM heatmap" className="absolute inset-0 size-full" draggable={false} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="overlay" disabled={!heat}><Layers /> Overlay</TabsTrigger>
            <TabsTrigger value="side" disabled={!heat}><Columns2 /> Side by side</TabsTrigger>
            <TabsTrigger value="input"><ScanLine /> Model input</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button variant="outline" size="icon" aria-label="Zoom out" onClick={() => setZoom(view.zoom - 0.5)} disabled={view.zoom <= 1}>
            <Minus />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">{view.zoom.toFixed(1)}×</span>
          <Button variant="outline" size="icon" aria-label="Zoom in" onClick={() => setZoom(view.zoom + 0.5)} disabled={view.zoom >= 4}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Reset zoom" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
            <RotateCcw />
          </Button>
        </div>
      </div>

      {mode === "overlay" && heat && (
        <div className="mx-auto max-w-xl">
          <Panel label="Heatmap over retina" view={view} onPan={pan}>
            {original}
            <img src={heat} alt="Grad-CAM heatmap overlay" className="absolute inset-0 size-full" style={{ opacity: opacity / 100 }} draggable={false} />
          </Panel>
        </div>
      )}
      {mode === "side" && heat && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel label="Original retina" view={view} onPan={pan}>{original}</Panel>
          <Panel label="Grad-CAM heatmap" view={view} onPan={pan}>{heatOnly}</Panel>
        </div>
      )}
      {mode === "input" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel label="Original retina" view={view} onPan={pan}>{original}</Panel>
          <Panel label="Model input (Ben Graham enhanced)" view={view} onPan={pan}>
            <img src={images.processed} alt="Contrast-enhanced model input" className="absolute inset-0 size-full" draggable={false} />
          </Panel>
        </div>
      )}

      {mode === "overlay" && heat && (
        <div className="mx-auto max-w-xl space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="opacity">Heatmap opacity</Label>
            <span className="text-sm text-muted-foreground tabular-nums">{opacity}%</span>
          </div>
          <Slider id="opacity" value={[opacity]} min={0} max={100} step={5} onValueChange={([v]) => setOpacity(v)} aria-label="Heatmap opacity" />
        </div>
      )}

      <div className="mx-auto flex max-w-xl items-center gap-3 text-xs text-muted-foreground">
        <span>Lower influence</span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{ background: "linear-gradient(90deg,#00007f,#0000ff,#00ffff,#ffff00,#ff0000,#7f0000)" }}
          aria-hidden="true"
        />
        <span>Higher influence</span>
      </div>

      {!heat && (
        <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> Grad-CAM was not produced for this result (the ML service had no
          PyTorch weights loaded), so only the images are shown. No substitute heatmap is ever displayed.
        </p>
      )}
    </div>
  );
}
