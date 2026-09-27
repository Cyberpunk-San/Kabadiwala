// src/ui/materials.tsx — one line icon per material (Material Community Icons),
// shown on a neutral tile. `tint` is the single accent so charts stay restrained.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "../constants/theme";
import type { Material } from "../types/domain";

import { P } from "../constants/palette";
type McIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

const accent = [colors.primary, colors.primary] as const;
export const MATERIAL_STYLE: Record<Material, { icon: McIcon; colors: readonly [string, string]; tint: string }> = {
  "Copper cable": { icon: "cable-data", colors: accent, tint: colors.primary },
  "Server boards": { icon: "server", colors: accent, tint: colors.primary },
  Aluminium: { icon: "cup", colors: accent, tint: colors.primary },
  "Mixed e-waste": { icon: "devices", colors: accent, tint: colors.primary },
  "Lithium-ion batteries": { icon: "battery-high", colors: accent, tint: colors.primary },
  "Brass fittings": { icon: "pipe-valve", colors: accent, tint: colors.primary },
  "Printed Circuit Boards (PCB)": { icon: "chip", colors: accent, tint: colors.primary },
  "Electric motors": { icon: "engine", colors: accent, tint: colors.primary },
  "Iron & steel scrap": { icon: "hammer-wrench", colors: accent, tint: colors.primary },
  "CRT & monitor glass": { icon: "monitor", colors: accent, tint: colors.primary },
  "Lead acid batteries": { icon: "car-battery", colors: accent, tint: colors.primary },
  "Compressors & cooling units": { icon: "snowflake", colors: accent, tint: colors.primary },
  Newspaper: { icon: "newspaper-variant-outline", colors: accent, tint: colors.primary },
  "Books & notebooks": { icon: "book-open-page-variant-outline", colors: accent, tint: colors.primary },
  Cardboard: { icon: "package-variant", colors: accent, tint: colors.primary },
  "Mixed plastic": { icon: "bucket-outline", colors: accent, tint: colors.primary },
  "PET bottles": { icon: "bottle-soda-classic-outline", colors: accent, tint: colors.primary },
  "Stainless steel": { icon: "silverware-fork-knife", colors: accent, tint: colors.primary },
};

export function materialStyle(material: string) {
  return MATERIAL_STYLE[material as Material] ?? MATERIAL_STYLE["Mixed e-waste"];
}

/** Material icon on a neutral tile. `onDark` for use on the accent hero. */
export function MaterialAvatar({ material, size = 44, onDark }: { material: string; size?: number; onDark?: boolean }) {
  const st = materialStyle(material);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }, onDark && { borderColor: P("rgba(248,250,247,0.16)") }]}>
      <MaterialCommunityIcons name={st.icon} size={Math.round(size * 0.48)} color={P("#A8E8C9")} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", backgroundColor: P("#020705"), borderWidth: 1, borderColor: P("rgba(168,232,201,0.14)") },
});
