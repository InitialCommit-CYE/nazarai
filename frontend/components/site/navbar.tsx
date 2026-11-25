import { Suspense } from "react";

import { getViewer } from "@/lib/server/auth";

import { NavbarClient, type NavViewer } from "./navbar-client";

/** The bar renders immediately; who is signed in streams in behind the boundary. */
export function Navbar() {
  return (
    <Suspense fallback={<NavbarClient viewer={null} loading />}>
      <NavbarWithViewer />
    </Suspense>
  );
}

async function NavbarWithViewer() {
  const v = await getViewer();
  const viewer: NavViewer | null =
    v && v.active ? { id: v.id, fullName: v.fullName, email: v.email, role: v.role, clinicName: v.clinicName } : null;
  return <NavbarClient viewer={viewer} />;
}
