import { describe, expect, it } from "vitest";
import { canGrantLogin, hashInviteToken, roleKey, safeInviteLink, smtpPasswordUsable, validEmail } from "@/lib/login-access";
import { readViewAs, signViewAs } from "@/lib/view-as-token";

describe("smtp password", () => {
  it("rejects empty values and the install placeholders", () => {
    expect(smtpPasswordUsable("crcptalink@gmail.com", "")).toBe(false);
    expect(smtpPasswordUsable("", "real-password")).toBe(false);
    expect(smtpPasswordUsable("crcptalink@gmail.com", "REPLACE_WITH_GMAIL_APP_PASSWORD")).toBe(false);
    expect(smtpPasswordUsable("crcptalink@gmail.com", "change-me")).toBe(false);
    expect(smtpPasswordUsable("crcptalink@gmail.com", "abcd efgh ijkl mnop")).toBe(true);
  });
});

describe("who can give a login", () => {
  it("lets an admin set anyone, and a leader only a member", () => {
    expect(canGrantLogin({ appRole: "ADMIN" }, { appRole: "VOLUNTEER", departmentRole: "VOLUNTEER" })).toBe(true);
    expect(canGrantLogin({ appRole: "ADMIN" }, { appRole: "ADMIN", departmentRole: "LEADER" })).toBe(true);
    expect(canGrantLogin({ appRole: "VOLUNTEER" }, { appRole: "VOLUNTEER", departmentRole: "VOLUNTEER" })).toBe(true);
    expect(canGrantLogin({ appRole: "VOLUNTEER" }, { appRole: "VOLUNTEER", departmentRole: "LEADER" })).toBe(false);
    expect(canGrantLogin({ appRole: "VOLUNTEER" }, { appRole: "VOLUNTEER", departmentRole: "TWO_IC" })).toBe(false);
    expect(canGrantLogin({ appRole: "VOLUNTEER" }, { appRole: "ADMIN", departmentRole: "LEADER" })).toBe(false);
    expect(canGrantLogin({ appRole: "ADMIN", impersonatorId: "admin" }, { appRole: "VOLUNTEER", departmentRole: "VOLUNTEER" })).toBe(false);
  });

  it("maps stored roles to the People dropdown", () => {
    expect(roleKey("ADMIN", "VOLUNTEER")).toBe("ADMIN");
    expect(roleKey("VOLUNTEER", "LEADER")).toBe("LEADER");
    expect(roleKey("VOLUNTEER", "TWO_IC")).toBe("TWO_IC");
    expect(roleKey("VOLUNTEER", null)).toBe("VOLUNTEER");
  });
});

describe("invite links", () => {
  it("hashes the token and only echoes our own invite URL", () => {
    expect(validEmail("candice@example.com")).toBe(true);
    expect(validEmail("not an email")).toBe(false);
    const hash = hashInviteToken("abc");
    expect(hash).toHaveLength(64);
    expect(hashInviteToken("abc")).toBe(hash);
    const token = "a".repeat(64);
    const url = `http://192.168.81.99:3000/invite/${token}`;
    expect(safeInviteLink(url, "http://192.168.81.99:3000")).toBe(url);
    expect(safeInviteLink("https://evil.example/invite/" + token, "http://192.168.81.99:3000")).toBeNull();
    expect(safeInviteLink(url + "?x=1", "http://192.168.81.99:3000")).toBeNull();
  });
});

describe("view as cookie", () => {
  it("round-trips and rejects a forged signature", () => {
    const secret = "test-secret";
    const value = signViewAs("admin1", "candice1", secret);
    expect(readViewAs(value, secret)).toEqual({ adminId: "admin1", targetId: "candice1" });
    expect(readViewAs(value, "other")).toBeNull();
    expect(readViewAs(value.slice(0, -2) + "xx", secret)).toBeNull();
    expect(readViewAs("admin1:candice1.not-a-sig", secret)).toBeNull();
    expect(signViewAs("admin1", "admin1", secret)).toBeTruthy();
    expect(readViewAs(signViewAs("admin1", "admin1", secret), secret)).toBeNull();
  });
});
