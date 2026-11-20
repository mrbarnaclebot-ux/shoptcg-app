import { beforeEach, expect, test, vi } from "vitest";
import {
  listPending,
  savePending,
  sendPending,
  type PendingSale,
} from "@/lib/pending-sales";
import type { ConfirmResult } from "@/lib/sales";

// A Map behind the Storage methods the module uses.
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
});

const sale = (requestId: string): PendingSale => ({
  input: {
    requestId,
    lines: [{ listingId: "l", qty: 1, unitPrice: "5.00" }],
    discount: { kind: "none" },
    method: "cash",
  },
  buyer: "Maya R.",
  total: "$5.00",
  emailed: true,
});

const ok = (n: string): ConfirmResult => ({
  ok: true,
  saleId: `s${n}`,
  receiptNo: `R-000${n}`,
  total: "5.00",
});

test("a recorded sale leaves the phone; a refused one stays with the reason", async () => {
  savePending(sale("a"));
  savePending(sale("b"));
  const sent = vi.fn();
  const refused = vi.fn();
  await sendPending(
    async (input) => (input.requestId === "a" ? ok("1") : { stock: ["l"] }),
    { sent, refused },
  );
  expect(sent).toHaveBeenCalledOnce();
  expect(refused).toHaveBeenCalledWith(
    expect.objectContaining({ buyer: "Maya R." }),
    expect.stringMatching(/stock changed/),
  );
  expect(listPending()).toEqual([
    { ...sale("b"), refused: expect.stringMatching(/stock changed/) },
  ]);
  // A refused sale isn't resent by itself; the vendor opens the request.
  const send = vi.fn();
  await sendPending(send, { sent, refused });
  expect(send).not.toHaveBeenCalled();
});

test("still offline: nothing is dropped and the round stops", async () => {
  savePending(sale("a"));
  savePending(sale("b"));
  const send = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  await sendPending(send, { sent: vi.fn(), refused: vi.fn() });
  expect(send).toHaveBeenCalledOnce();
  expect(listPending()).toHaveLength(2);
});

test("a sale that already landed comes back as the first sale, once", async () => {
  savePending(sale("a"));
  const sent = vi.fn();
  await sendPending(async () => ({ ...ok("1"), retry: true }), {
    sent,
    refused: vi.fn(),
  });
  expect(sent).toHaveBeenCalledOnce();
  expect(listPending()).toEqual([]);
});
