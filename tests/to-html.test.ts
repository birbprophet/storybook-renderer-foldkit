import { describe, expect, test } from "vitest";
import { toHtml } from "../src/to-html.ts";

describe("toHtml", () => {
  test("renders text nodes and strings", () => {
    expect(toHtml("Hello world")).toBe("Hello world");
    expect(toHtml(null)).toBe("");
    expect(toHtml(undefined)).toBe("");
  });

  test("renders elements with classes, styles, and attributes", () => {
    const vnode = {
      sel: "button",
      data: {
        class: { "btn": true, "btn-primary": true, "inactive": false },
        style: { backgroundColor: "red", fontSize: "16px" },
        attrs: { type: "submit", "aria-label": "Submit form", disabled: true },
      },
      children: ["Click me"],
    };
    expect(toHtml(vnode)).toBe(
      `<button class="btn btn-primary" style="background-color:red;font-size:16px" type="submit" aria-label="Submit form" disabled>Click me</button>`
    );
  });

  test("handles void elements", () => {
    const inputNode = {
      sel: "input",
      data: {
        attrs: { type: "text", placeholder: "Search..." },
        props: { value: "test query" },
      },
    };
    expect(toHtml(inputNode)).toBe(`<input type="text" placeholder="Search..." value="test query" />`);
  });

  test("handles nested children", () => {
    const div = {
      sel: "div",
      data: { class: { "wrapper": true } },
      children: [
        { sel: "span", children: ["Label"] },
        { sel: "strong", children: ["Value"] },
      ],
    };
    expect(toHtml(div)).toBe(`<div class="wrapper"><span>Label</span><strong>Value</strong></div>`);
  });
});
