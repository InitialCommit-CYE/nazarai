"use client";

import { Camera, ImageUp, RefreshCcw } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface Props {
  previewUrl: string | null;
  fileLabel: string | null;
  disabled?: boolean;
  onFile: (file: File, source: "upload" | "camera") => void;
  onError: (msg: string) => void;
  onClear: () => void;
}

export function ImagePicker({ previewUrl, fileLabel, disabled, onFile, onError, onClear }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined, source: "upload" | "camera") => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) onError(err);
    else onFile(file, source);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Upload a fundus photo: click, or drag and drop an image"
        onClick={() => !disabled && fileInput.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0], "upload");
        }}
        className={cn(
          "group relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          dragging && "border-primary bg-primary/5",
          !disabled && "hover:border-primary/60 hover:bg-secondary/50",
          disabled && "cursor-default opacity-80",
        )}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={previewUrl} alt="Selected fundus photo preview" className="max-h-80 w-auto rounded-xl object-contain" />
            {fileLabel && <p className="mt-3 max-w-full truncate text-xs text-muted-foreground">{fileLabel}</p>}
          </>
        ) : (
          <>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <ImageUp className="size-7" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-medium">Drop a fundus photo here, or click to browse</p>
            <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG or WebP · up to 10 MB · colour retinal photograph</p>
          </>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0], "upload");
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0], "camera");
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => cameraInput.current?.click()}>
          <Camera /> Use camera
        </Button>
        {previewUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear}>
            <RefreshCcw /> Choose a different image
          </Button>
        )}
      </div>
    </div>
  );
}
