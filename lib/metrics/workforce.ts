import type { Dataset } from "@/lib/types";

export interface MonthPoint {
  month: string; // YYYY-MM
  hires: number;
  terminations: number;
}

export function monthlyHiresAndTerminations(ds: Dataset): MonthPoint[] {
  const months = new Map<string, MonthPoint>();
  for (const e of ds.events) {
    if (!e.eventDate) continue;
    const month = e.eventDate.slice(0, 7);
    const p = months.get(month) ?? { month, hires: 0, terminations: 0 };
    if (e.eventType === "Hire") p.hires++;
    if (e.eventType === "Termination") p.terminations++;
    months.set(month, p);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface DepartmentFlow {
  department: string;
  hires: number;
  terminations: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
  voluntary: number;
  involuntary: number;
  layoff: number;
  unknownReason: number;
}

export function departmentFlows(ds: Dataset): DepartmentFlow[] {
  const flows = new Map<string, DepartmentFlow>();
  const get = (department: string) => {
    const f = flows.get(department) ?? {
      department, hires: 0, terminations: 0, transfersIn: 0, transfersOut: 0, net: 0,
      voluntary: 0, involuntary: 0, layoff: 0, unknownReason: 0,
    };
    flows.set(department, f);
    return f;
  };
  for (const e of ds.events) {
    const f = get(e.department);
    if (e.eventType === "Hire") f.hires++;
    if (e.eventType === "Termination") {
      f.terminations++;
      if (e.terminationReason === "Voluntary") f.voluntary++;
      else if (e.terminationReason === "Involuntary") f.involuntary++;
      else if (e.terminationReason === "Layoff") f.layoff++;
      else f.unknownReason++;
    }
    // Same-department "transfers" are data errors (flagged in reconciliation), not moves.
    if (e.eventType === "Transfer" && e.toDepartment && e.toDepartment !== e.department) {
      f.transfersOut++;
      get(e.toDepartment).transfersIn++;
    }
  }
  for (const f of flows.values()) f.net = f.hires + f.transfersIn - f.terminations - f.transfersOut;
  return [...flows.values()].sort((a, b) => a.net - b.net);
}
