import { describe, expect, it } from "vitest";
import { maskDeep, maskText, tcknValid } from "../src/mask";

describe("maskText", () => {
  it("masks Luhn-valid card numbers", () => {
    expect(maskText("kartım 4111 1111 1111 1111 bu")).toBe("kartım **** **** **** 1111 bu");
    expect(maskText("5555-5555-5555-4444")).toBe("**** **** **** 4444");
  });
  it("keeps non-Luhn digit runs (order ids)", () => {
    expect(maskText("sipariş 1234567890123")).toBe("sipariş 1234567890123");
  });
  it("masks IBAN", () => {
    expect(maskText("TR33 0006 1005 1978 6457 8413 26")).toBe("TR** **** **** 1326");
  });
  it("masks valid TCKN only", () => {
    expect(tcknValid("10000000146")).toBe(true);
    expect(maskText("tc: 10000000146")).toBe("tc: *********46");
    expect(maskText("no: 12345678901")).toBe("no: 12345678901");
  });
  it("masks phone numbers", () => {
    expect(maskText("0532 123 45 67")).toBe("05** *** ** 67");
    expect(maskText("+90 532 123 4567")).toBe("+90 5** *** ** 67");
  });
  it("masks deeply", () => {
    expect(maskDeep({ a: ["4111111111111111"], b: { phone: "05321234567" } })).toEqual({
      a: ["**** **** **** 1111"],
      b: { phone: "05** *** ** 67" },
    });
  });
});
