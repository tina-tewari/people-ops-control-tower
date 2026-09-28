// Checks the headcount plan and recruiting pipeline against lib/data/validate.ts.
// Exits non-zero when any row breaks a rule.
//
// Usage: DATASET=real npm run validate:data

import { readFileSync } from "node:fs";
import path from "node:path";
import { validateRequisitionData } from "@/lib/data/validate";
import { parseCsv } from "@/lib/parsers/csv";

const dir = path.join(process.cwd(), "data", process.env.DATASET ?? "real");
const read = (f: string) => parseCsv(readFileSync(path.join(dir, f), "utf8"));
const issues = validateRequisitionData(read("headcount_plan.csv"), read("recruiting_pipeline.csv"));

for (const i of issues) console.log(`${i.file} ${i.row} ${i.column}: ${i.message}`);
console.log(`${path.relative(process.cwd(), dir)}: ${issues.length} issue${issues.length === 1 ? "" : "s"}`);
process.exit(issues.length ? 1 : 0);
