import { Suspense } from "react";
import { InventoryView } from "@/components/inventory/InventoryView";

export default function InventoryPage() {
  // InventoryView đọc ?status= từ URL nên cần Suspense boundary theo yêu cầu của Next.
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
      <InventoryView />
    </Suspense>
  );
}
