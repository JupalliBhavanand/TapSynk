"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteEmployeeCard } from "./actions";

export function RemoveCard({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${name}'s card? Its link stops working and the seat frees up.`)) return;
        start(async () => {
          const res = await deleteEmployeeCard(id);
          if (!res.ok) alert(res.error);
        });
      }}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-stamp/10 hover:text-stamp"
      aria-label={`Remove ${name}'s card`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
