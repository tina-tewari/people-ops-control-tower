// Single entry point for pages: load → reconcile → compute metrics.

import { cache } from "react";
import { getDataset } from "@/lib/data/load";
import { reconcile } from "@/lib/reconciliation/discrepancies";
import { buildActionQueue } from "@/lib/reconciliation/actions";
import { inferRequisitions } from "@/lib/reconciliation/requisitions";
import { headcountRisk } from "@/lib/metrics/headcount";
import { overviewKpis } from "@/lib/metrics/overview";
import { timingSummary } from "@/lib/metrics/timing";
import { keyFindings } from "@/lib/metrics/insights";

function buildCore() {
  const dataset = getDataset();
  const { discrepancies, offerComparisons } = reconcile(dataset);
  const reqModel = inferRequisitions(dataset);
  return {
    dataset,
    discrepancies,
    offerComparisons,
    reqModel,
    headcountRisk: headcountRisk(reqModel.requisitions, dataset.meta.asOf),
    kpis: overviewKpis(dataset, discrepancies),
    actionQueue: buildActionQueue(dataset, discrepancies),
    timing: timingSummary(dataset),
  };
}

export type ControlTowerCore = ReturnType<typeof buildCore>;

export const getControlTower = cache(() => {
  const core = buildCore();
  return { ...core, findings: keyFindings(core) };
});

export type ControlTower = ReturnType<typeof getControlTower>;
