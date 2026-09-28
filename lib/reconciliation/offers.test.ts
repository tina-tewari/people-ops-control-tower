import assert from "node:assert/strict";
import { test } from "node:test";
import { getDataset } from "@/lib/data/load";
import { compareOffers } from "./offers";

const priya = (letterDetail?: string) => {
  const ds = getDataset();
  const letters = ds.letters.map((l) =>
    l.candidateId === "C0002" && letterDetail ? { ...l, commissionDetail: letterDetail } : l,
  );
  return compareOffers(ds.offers, letters).find((c) => c.candidateId === "C0002")!;
};

test("Recruiting Ops decisions settle Priya's uncapped commission", () => {
  const c = priya();
  const detail = c.fields.find((f) => f.key === "commissionDetail")!;
  assert.equal(detail.resolution, "Confirmed by Ops");
  assert.equal(detail.rule, null);
  assert.equal(c.normalized.commissionDetail, detail.letter);
  assert.deepEqual(c.letterOnlyTerms, []);
  assert.deepEqual(c.approvedTerms.map((a) => a.term), ["Commission: uncapped"]);
  assert.equal(c.verification, "Resolved");
});

test("a decision stops applying once the letter value changes", () => {
  const c = priya("12% of closed ARR, paid quarterly; uncapped; OTE $150,000");
  const detail = c.fields.find((f) => f.key === "commissionDetail")!;
  assert.equal(detail.resolution, "Needs review");
  assert.equal(c.verification, "Flagged");
});
