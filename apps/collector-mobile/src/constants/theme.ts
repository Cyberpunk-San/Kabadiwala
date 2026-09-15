import { MD3LightTheme } from "react-native-paper";

export const colors = {
  ink: "#18352D",
  muted: "#687A72",
  green: "#124A3B",
  greenLight: "#DFF4E9",
  cream: "#FBF9F1",
  amber: "#F6BE49",
  orange: "#E9823C",
  danger: "#BD443A",
  line: "#E1E7E0",
  white: "#FFFFFF"
} as const;

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.green,
    secondary: colors.orange,
    surface: colors.white,
    background: colors.cream,
    onSurface: colors.ink
  }
};
