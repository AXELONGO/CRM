"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm font-medium"
      onClick={signOut}
      type="button"
    >
      Cerrar sesion
    </button>
  );
}
