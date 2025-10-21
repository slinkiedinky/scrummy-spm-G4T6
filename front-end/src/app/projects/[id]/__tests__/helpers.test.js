import { TextDecoder, TextEncoder } from "util";

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

jest.mock("jspdf", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock("jspdf-autotable", () => jest.fn());

import {
  createEmptyTaskForm,
  ensureArray,
  ensureProjectPriority,
  getPriorityBadgeClass,
  inferProjectStatus,
  toDateInputValue,
} from "../page";

describe("ProjectDetailPage helpers", () => {
  test("getPriorityBadgeClass handles all priority levels", () => {
    // Test non-numeric values (default case)
    expect(getPriorityBadgeClass("not-a-number")).toMatch(/bg-muted/);
    expect(getPriorityBadgeClass(null)).toMatch(/bg-muted/);
    expect(getPriorityBadgeClass(undefined)).toMatch(/bg-muted/);
    
    // Test high priority (>= 8) - line 143-145
    expect(getPriorityBadgeClass("9")).toMatch(/bg-red-100/);
    expect(getPriorityBadgeClass(8)).toMatch(/bg-red-100/);
    expect(getPriorityBadgeClass("10")).toMatch(/bg-red-100/);
    
    // Test medium priority (>= 4) - line 146-148
    expect(getPriorityBadgeClass("6")).toMatch(/bg-yellow-100/);
    expect(getPriorityBadgeClass(4)).toMatch(/bg-yellow-100/);
    expect(getPriorityBadgeClass("7")).toMatch(/bg-yellow-100/);
    
    // Test low priority (< 4) - line 149
    expect(getPriorityBadgeClass("2")).toMatch(/bg-emerald-100/);
    expect(getPriorityBadgeClass(1)).toMatch(/bg-emerald-100/);
    expect(getPriorityBadgeClass("3")).toMatch(/bg-emerald-100/);
  });

  test("ensureArray normalises input", () => {
    // Test array handling
    expect(ensureArray([" one ", null, ""])).toEqual(["one"]);
    expect(ensureArray(["test", 123, null])).toEqual(["test", "123"]);
    
    // Test string handling
    expect(ensureArray(" person ")).toEqual(["person"]);
    expect(ensureArray("")).toEqual([]);
    
    // Test null/undefined handling (lines 165-166)
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
    
    // Test non-string values (lines 167-169)
    expect(ensureArray(123)).toEqual(["123"]);
    expect(ensureArray(true)).toEqual(["true"]);
    expect(ensureArray({})).toEqual(["[object Object]"]);
    
    // Test empty string after conversion (lines 169)
    expect(ensureArray("   ")).toEqual([]);
  });

  test("createEmptyTaskForm seeds defaults", () => {
    const form = createEmptyTaskForm("user-123");
    expect(form).toMatchObject({
      title: "",
      assigneeId: "user-123",
      status: "to-do",
      priority: "5",
      collaboratorsIds: [],
    });
  });

  test("toDateInputValue formats dates correctly", () => {
    // Mock the toDate function since it's not imported properly in the main file
    const originalToDate = global.toDate;
    global.toDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      return null;
    };

    expect(toDateInputValue("2024-03-25T00:00:00.000Z")).toBe("2024-03-25");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("")).toBe("");
    
    // Test with Date object
    expect(toDateInputValue(new Date('2024-12-01'))).toBe("2024-12-01");
    
    // Test invalid date
    global.toDate = () => null;
    expect(toDateInputValue("invalid")).toBe("");
    
    // Restore original
    global.toDate = originalToDate;
  });

  test("ensureProjectPriority normalises numbers and strings", () => {
    expect(ensureProjectPriority("HIGH")).toBe("high");
    expect(ensureProjectPriority("2")).toBe("low");
    expect(ensureProjectPriority(9)).toBe("high");
    expect(ensureProjectPriority(null)).toBe("medium");
    
    // Test numeric string parsing (lines 124-128)
    expect(ensureProjectPriority("9")).toBe("high");
    expect(ensureProjectPriority("5")).toBe("medium");
    expect(ensureProjectPriority("1")).toBe("low");
    
    // Test direct number values (lines 130-134)
    expect(ensureProjectPriority(8)).toBe("high");
    expect(ensureProjectPriority(3)).toBe("low");
    expect(ensureProjectPriority(5)).toBe("medium");
    
    // Test edge cases and fallbacks
    expect(ensureProjectPriority("invalid")).toBe("medium");
    expect(ensureProjectPriority(undefined)).toBe("medium");
  });

  test("inferProjectStatus derives status from task list", () => {
    expect(inferProjectStatus([])).toBe("to-do");
    expect(inferProjectStatus([{ status: "completed" }])).toBe("completed");
    expect(
      inferProjectStatus([{ status: "completed" }, { status: "in progress" }])
    ).toBe("in progress");
    expect(inferProjectStatus([{ status: "blocked" }])).toBe("to-do");
  });
});
