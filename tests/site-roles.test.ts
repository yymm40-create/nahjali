import { describe, expect, it } from "vitest";
import { isAdmin, isCoOwner, isOwner, mayActOn } from "@config/site";

describe("the owner and the co-owner", () => {
  it("both run the site", () => {
    expect(isAdmin("yymm40@gmail.com")).toBe(true);
    expect(isAdmin("Narjiszahra912@gmail.com")).toBe(true);
    expect(isOwner("narjiszahra912@gmail.com")).toBe(false);
    expect(isCoOwner("narjiszahra912@gmail.com")).toBe(true);
  });
  it("the co-owner can't act on the owner's account; the owner can act on anyone", () => {
    expect(mayActOn("narjiszahra912@gmail.com", "yymm40@gmail.com")).toBe(false);
    expect(mayActOn("narjiszahra912@gmail.com", "someone@example.com")).toBe(true);
    expect(mayActOn("yymm40@gmail.com", "narjiszahra912@gmail.com")).toBe(true);
    expect(mayActOn("narjiszahra912@gmail.com", "")).toBe(true);
  });
});
