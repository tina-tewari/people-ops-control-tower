import type { DatasetMeta } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function DataBanner({ meta }: { meta: DatasetMeta }) {
  return (
    <div
      className={`border-b px-4 py-2 text-xs sm:px-8 ${
        meta.isSample
          ? "border-warning/40 bg-warning/10 text-ink-2"
          : "border-line bg-surface text-ink-3"
      }`}
    >
      <span className="font-medium text-ink">{meta.label}</span>
      {meta.isSample && " — every figure is computed from placeholder rows and is illustrative only."}
      <span className="ml-2 text-ink-3">Data as of {formatDate(meta.asOf)}</span>
    </div>
  );
}
