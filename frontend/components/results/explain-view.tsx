"use client";

import { EyeOff, Lightbulb, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { ReferralBadge } from "@/components/clinical/referral-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { GradCamViewer } from "./gradcam-viewer";
import { useScreening } from "./screening-context";

export function ExplainView() {
  const { screening: s, images } = useScreening();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-lg">
            Where the model looked
            {s.urgency && <ReferralBadge urgency={s.urgency} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {images ? (
            <GradCamViewer images={images} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <EyeOff className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="max-w-md text-sm text-muted-foreground">
                For privacy, retinal images and heatmaps are never stored on the server. They are visible only in the
                browser tab that ran this screening. Run a new screening to explore its Grad-CAM.
              </p>
              <Button asChild variant="outline"><Link href="/screen">New screening</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="size-4 text-primary" /> How to read this</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Grad-CAM highlights the regions whose features most <strong className="text-foreground">increased the predicted
              severity score</strong>. Warm colours (red, yellow) mean stronger influence.
            </p>
            <p>
              In referable cases, clinicians typically expect attention on lesions such as haemorrhages, hard exudates or
              new vessels. Attention on the optic disc rim or image edges may indicate the model is using less relevant cues.
            </p>
            <p>The heatmap is computed at 384 × 384 px from the final convolutional block, so it is coarse by design.</p>
          </CardContent>
        </Card>
        <div className="flex gap-2.5 rounded-[20px] border border-white/10 bg-[#121418] p-4 text-sm leading-relaxed text-ink-muted">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-refer" aria-hidden="true" />
          <p>
            A heatmap explains what influenced the model. It is{" "}
            <strong className="font-medium text-foreground">not proof that the result is clinically correct</strong>, and it is not a
            lesion segmentation.
          </p>
        </div>
      </div>
    </div>
  );
}
