import type { Dataset } from "@/lib/types";

export interface DepartmentHeadcount {
  department: string;
  approved: number;
  filled: number;
  open: number;
  openHighPriority: number;
}

export function headcountByDepartment(ds: Dataset): DepartmentHeadcount[] {
  const byDept = new Map<string, DepartmentHeadcount>();
  for (const h of ds.headcount) {
    const d = byDept.get(h.department) ?? { department: h.department, approved: 0, filled: 0, open: 0, openHighPriority: 0 };
    d.approved += h.approvedHeadcount;
    d.filled += h.filledSeats;
    d.open += h.openSeats;
    if (h.priority === "High") d.openHighPriority += h.openSeats;
    byDept.set(h.department, d);
  }
  return [...byDept.values()].sort((a, b) => b.open - a.open);
}
