// src/constants/palette.ts — every colour in the app is written in its dark-theme value and passed through P().
// In dark mode P() returns it unchanged; in light mode it returns the light counterpart.
// Light palette: paper #EEF1EC, card #F8FAF7/white, ink #15201C, soft ink #56635D, green #1F7560,
// amber #B7791F, red #C4483E.
import { isLight } from "./themeMode";

const HEX: Record<string, string> = {
  // backgrounds & surfaces
  "#030907": "#EEF1EC", "#061311": "#EEF1EC", "#010403": "#DDE3DE",
  "#0C1D1A": "#F8FAF7", "#122622": "#E6ECE7", "#0B1A17": "#FFFFFF", "#062019": "#FFFFFF",
  "#020705": "#FFFFFF",                                   // icon discs: black on dark → white on light
  "#1C2E2A": "#D5DDD7",                                   // lines
  // hero / tints
  "#12493E": "#D3E6DD", "#17604F": "#E3F0EA", "#0F3E34": "#D5E8DF", "#08251F": "#CBE2D8", "#0E2D26": "#DCEFE6",
  "#2A2317": "#F6EBD6", "#2A2118": "#F8E6DC", "#2E1719": "#F7E1DE", "#12262A": "#DDEFF1", "#1C1B31": "#E6E5F6",
  // text
  "#F8FAF7": "#15201C", "#E4EAE4": "#15201C", "#A3ABA8": "#56635D", "#8C9692": "#6B7771", "#5E6A66": "#8A948F",
  // accents
  "#A8E8C9": "#1F7560", "#19A982": "#1F7560", "#04120F": "#FFFFFF",
  "#E5B86A": "#B7791F", "#E7898F": "#C4483E", "#F08DB8": "#B8457A",
  "#7CC4CC": "#2F7F87", "#5CC8C8": "#2F7F87", "#A7A5E8": "#5B58B8", "#A48BFA": "#6D4FD1", "#6F8DFF": "#3E5CC9",
  "#FFF0BA": "#7A5A12",
};

// rgb family (dark theme) → rgb in light theme; alpha kept unless noted in rgba()
const FAMILY: Record<string, string> = {
  "168,232,201": "31,117,96", "143,217,187": "31,117,96", "111,179,158": "31,117,96", "25,169,130": "31,117,96",
  "229,184,106": "183,121,31", "217,152,46": "183,121,31",
  "231,137,143": "196,72,62", "233,130,95": "196,72,62",
  "124,196,204": "47,127,135", "47,168,184": "47,127,135",
  "167,165,232": "91,88,184",
  "18,73,62": "31,117,96", "10,74,55": "31,117,96",
};

function rgba(value: string): string {
  const m = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (!m) return value;
  const rgb = `${m[1]},${m[2]},${m[3]}`;
  const a = Number(m[4]);
  if (rgb === "248,250,247") {
    // Off-white "glass" on dark: faint fills become white cards; hairlines and text become ink.
    if (a === 0) return "rgba(255,255,255,0)";
    if (a < 0.08) return `rgba(255,255,255,${Math.min(0.9, 0.62 + a * 3).toFixed(2)})`;
    if (a < 0.3) return `rgba(21,32,28,${(a * 0.9).toFixed(3)})`;
    return `rgba(21,32,28,${Math.min(1, a * 1.1).toFixed(2)})`;
  }
  if (rgb === "18,73,62") return `rgba(31,117,96,${(a * 0.3).toFixed(3)})`;   // hero washes: much lighter
  if (FAMILY[rgb]) return `rgba(${FAMILY[rgb]},${a})`;
  if (rgb === "0,0,0" && a >= 0.4) return `rgba(21,32,28,${(a * 0.55).toFixed(2)})`;   // scrims (shadows stay)
  if (rgb === "6,19,17") return `rgba(21,32,28,${(a * 0.6).toFixed(2)})`;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (r < 50 && g < 50 && b < 50 && rgb !== "0,0,0") return `rgba(255,255,255,${a})`;   // dark glass → light glass
  return value;
}

/** A colour written in its dark-theme value → the value for the current theme. */
export function P(dark: string): string {
  if (!isLight) return dark;
  if (dark.startsWith("rgba")) return rgba(dark);
  return HEX[dark.toUpperCase()] ?? dark;
}
