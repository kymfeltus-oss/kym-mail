"use client";

import { useRouter } from "next/navigation";

export function ClientSignOutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/clients/sign-out", { method: "POST" });
    router.push("/client/sign-in");
    router.refresh();
  }
  return <button type="button" onClick={signOut} className="text-sm font-semibold text-[#526173]">Sign out</button>;
}
