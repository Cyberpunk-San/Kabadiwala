// Light palette mapping. The theme is fixed at startup, so each block loads the module fresh in one mode.
describe("dark mode", () => {
  it("returns every colour unchanged", () => {
    jest.isolateModules(() => {
      jest.doMock("./themeMode", () => ({ isLight: false }));
      const { P } = require("./palette") as typeof import("./palette");
      for (const c of ["#A8E8C9", "#020705", "rgba(248,250,247,0.62)", "rgba(0,0,0,0.5)", "#FFFFFF"]) expect(P(c)).toBe(c);
    });
  });
});

describe("light mode", () => {
  let P: (c: string) => string;
  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock("./themeMode", () => ({ isLight: true }));
      P = (require("./palette") as typeof import("./palette")).P;
    });
  });

  it("maps the core palette to the light brief", () => {
    expect(P("#030907")).toBe("#EEF1EC");   // background
    expect(P("#F8FAF7")).toBe("#15201C");   // text
    expect(P("#A8E8C9")).toBe("#1F7560");   // accent
    expect(P("#E5B86A")).toBe("#B7791F");   // amber
    expect(P("#E7898F")).toBe("#C4483E");   // red
    expect(P("#020705")).toBe("#FFFFFF");   // icon discs
    expect(P("#a8e8c9")).toBe("#1F7560");   // case-insensitive
  });

  it("turns off-white glass into white cards, hairlines and ink text", () => {
    expect(P("rgba(248,250,247,0)")).toBe("rgba(255,255,255,0)");
    expect(P("rgba(248,250,247,0.045)")).toMatch(/^rgba\(255,255,255,0\.[6-9]\d*\)$/);   // card fill
    expect(P("rgba(248,250,247,0.14)")).toMatch(/^rgba\(21,32,28,/);                       // hairline
    expect(P("rgba(248,250,247,0.62)")).toBe("rgba(21,32,28,0.68)");                       // soft text
  });

  it("keeps accent families' alpha, lightens scrims, keeps shadows and whites", () => {
    expect(P("rgba(168,232,201,0.18)")).toBe("rgba(31,117,96,0.18)");
    expect(P("rgba(229,184,106,0.1)")).toBe("rgba(183,121,31,0.1)");
    expect(P("rgba(0,0,0,0.62)")).toBe("rgba(21,32,28,0.34)");
    expect(P("rgba(0,0,0,0.05)")).toBe("rgba(0,0,0,0.05)");
    expect(P("rgba(9,22,19,0.94)")).toBe("rgba(255,255,255,0.94)");   // dark glass → light glass
    expect(P("#FFFFFF")).toBe("#FFFFFF");
  });

  it("text colours contrast with the light background", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };
    const bg = P("#030907");
    expect(ratio(P("#F8FAF7"), bg)).toBeGreaterThan(7);      // body text: AAA
    expect(ratio(P("#A8E8C9"), bg)).toBeGreaterThan(4.5);    // accent text: AA
    expect(ratio(P("#A3ABA8"), bg)).toBeGreaterThan(4.5);    // secondary text: AA
    expect(ratio("#FFFFFF", P("#19A982"))).toBeGreaterThan(4.5);   // white on primary buttons
  });
});
