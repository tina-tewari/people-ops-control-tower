// Server-only dataset loader. DATASET names a folder under data/ holding the four
// CSVs plus an offer_letters/ directory, e.g. DATASET=real → data/real.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { Dataset, ISODate } from "@/lib/types";
import { parseCsv } from "@/lib/parsers/csv";
import { parseOfferLetter } from "@/lib/parsers/offerLetter";
import {
  parseHeadcount,
  parseOfferLog,
  parsePeopleEvents,
  parsePipeline,
} from "@/lib/parsers/sources";

const DATASET = process.env.DATASET ?? "real";

function read(dir: string, file: string): string {
  return readFileSync(path.join(dir, file), "utf8");
}

/** Raw records (source column names) of one CSV in the active dataset. */
export function readSourceCsv(file: string): Record<string, string>[] {
  return parseCsv(read(path.join(process.cwd(), "data", DATASET), file));
}

export const getDataset = cache((): Dataset => {
  const dir = path.join(process.cwd(), "data", DATASET);
  const pipeline = parsePipeline(read(dir, "recruiting_pipeline.csv"));
  const headcount = parseHeadcount(read(dir, "headcount_plan.csv"));
  const offers = parseOfferLog(read(dir, "offer_log.csv"));
  const events = parsePeopleEvents(read(dir, "people_events.csv"));

  const letterDir = path.join(dir, "offer_letters");
  const letters = existsSync(letterDir)
    ? readdirSync(letterDir)
        .filter((f) => f.endsWith(".txt"))
        .sort()
        .map((f) => parseOfferLetter(f, read(letterDir, f)))
    : [];

  const dates: (ISODate | null)[] = [
    ...pipeline.flatMap((p) => [p.appliedDate, p.offerExtendedDate, p.offerCloseDate]),
    ...offers.flatMap((o) => [o.offerDate, o.closeDate]),
    ...events.map((e) => e.eventDate),
  ];
  const asOf = dates.filter((d): d is ISODate => d !== null).sort().at(-1) ?? "";

  const isSample = DATASET === "sample";
  return {
    meta: {
      label: isSample ? "Sample placeholder data" : "Take-home dataset",
      isSample,
      asOf,
    },
    pipeline,
    headcount,
    offers,
    events,
    letters,
  };
});
