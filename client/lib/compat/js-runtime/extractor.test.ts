import { describe, expect, it } from "vitest";
import { extractScripts, partitionScripts, stripScripts } from "./extractor";

describe("partitionScripts", () => {
  it("extracts classic script and strips from display", () => {
    const html = `Hello<script>console.log(1)</script>World`;
    const { display, scripts } = partitionScripts(html);
    expect(scripts).toEqual(["console.log(1)"]);
    expect(display).toBe("HelloWorld");
  });

  it("handles multiple scripts", () => {
    const html = `a<script>x</script>b<script>y</script>c`;
    const { display, scripts } = partitionScripts(html);
    expect(scripts).toEqual(["x", "y"]);
    expect(display).toBe("abc");
  });

  it("does not extract module scripts", () => {
    const html = `A<script type="module">import x from "y"</script>B`;
    const { display, scripts } = partitionScripts(html);
    expect(scripts).toEqual([]);
    expect(display).toBe("AB");
  });

  it("extracts text/javascript explicitly", () => {
    const html = `<script type="text/javascript">ok()</script>`;
    expect(partitionScripts(html).scripts).toEqual(["ok()"]);
  });

  it("stripScripts matches display from partitionScripts", () => {
    const raw = `x<script>a</script>y`;
    expect(stripScripts(raw)).toBe(partitionScripts(raw).display);
    expect(extractScripts(raw)).toEqual(partitionScripts(raw).scripts);
  });

  it("returns empty for empty input", () => {
    expect(partitionScripts("")).toEqual({ display: "", scripts: [] });
  });
});
