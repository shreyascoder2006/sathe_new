"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui";
import { BuildingIntelPanel } from "@/components/panels/BuildingIntelPanel";
import { buildingById } from "@/lib/geo/campus";
import { useCampus } from "@/lib/store";

export default function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const select = useCampus((s) => s.select);
  const layout = buildingById(id);

  useEffect(() => {
    select(id);
  }, [id, select]);

  return (
    <PageShell
      title={layout?.name ?? "Building"}
      eyebrow="Building Intelligence"
      subtitle={layout?.description}
      actions={
        <Link href="/" className="text-xs text-[var(--cyan)] hover:underline">
          <ArrowLeft className="mr-1 inline size-3.5" />
          Command Center
        </Link>
      }
    >
      <div className="max-w-2xl">
        <Card className="p-4">
          <BuildingIntelPanel buildingId={id} />
        </Card>
      </div>
    </PageShell>
  );
}
