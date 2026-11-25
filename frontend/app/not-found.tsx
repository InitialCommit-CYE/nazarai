import { Home, SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Also shown for records the user may not see: we never reveal whether a record exists. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <SearchX className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-muted-foreground">This page or record does not exist, or your account does not have access to it.</p>
      <Button asChild size="lg" className="mt-8 h-10 px-4">
        <Link href="/">
          <Home /> Go to the start page
        </Link>
      </Button>
    </div>
  );
}
