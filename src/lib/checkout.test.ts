import { describe, expect, it } from "vitest";
import { parseCheckout, payLabel } from "./checkout";

const none = {
  offerDelivery: false,
  offerPickup: false,
  acceptCash: false,
  acceptTransfer: false,
};
const all = {
  offerDelivery: true,
  offerPickup: true,
  acceptCash: true,
  acceptTransfer: true,
};

describe("parseCheckout", () => {
  it("asks nothing when the store offers nothing", () => {
    expect(parseCheckout(none, { fulfil: "delivery" })).toEqual({
      ok: true,
      value: {
        fulfil: null,
        payWith: null,
        buyerPhone: null,
        deliveryAddress: null,
      },
    });
  });

  it("needs a pick when there are two, and takes the only one", () => {
    expect(parseCheckout(all, {})).toMatchObject({
      errors: { fulfil: expect.any(String), payWith: expect.any(String) },
    });
    const only = { ...none, offerPickup: true, acceptTransfer: true };
    expect(parseCheckout(only, { fulfil: "delivery" })).toMatchObject({
      value: { fulfil: "pickup", payWith: "transfer" },
    });
  });

  it("refuses an option the store doesn't offer", () => {
    const s = { ...all, offerDelivery: false, offerPickup: false };
    expect(parseCheckout(s, { payWith: "card" })).toMatchObject({
      errors: { payWith: expect.any(String) },
    });
  });

  it("delivery needs a phone and an address; pickup drops the address", () => {
    expect(
      parseCheckout(all, { fulfil: "delivery", payWith: "cash" }),
    ).toMatchObject({
      errors: { phone: expect.any(String), address: expect.any(String) },
    });
    expect(
      parseCheckout(all, {
        fulfil: "delivery",
        payWith: "cash",
        phone: "abc",
        address: "12 Galle Rd, Colombo 3",
      }),
    ).toMatchObject({ errors: { phone: expect.any(String) } });
    expect(
      parseCheckout(all, {
        fulfil: "pickup",
        payWith: "transfer",
        address: "ignored",
      }),
    ).toMatchObject({
      value: { fulfil: "pickup", deliveryAddress: null, buyerPhone: null },
    });
    expect(
      parseCheckout(all, {
        fulfil: "delivery",
        payWith: "cash",
        phone: " +94 77 123 4567 ",
        address: " 12 Galle Rd, Colombo 3 ",
      }),
    ).toMatchObject({
      value: {
        buyerPhone: "+94 77 123 4567",
        deliveryAddress: "12 Galle Rd, Colombo 3",
      },
    });
  });

  it("names cash by how the cards arrive", () => {
    expect(payLabel("cash", "delivery")).toBe("Cash on delivery");
    expect(payLabel("cash", "pickup")).toBe("Cash at pickup");
    expect(payLabel("transfer", "pickup")).toBe("Bank transfer");
  });
});
