// src/ui/Tappable.tsx — drop-in for TouchableOpacity (deprecated on web): a Pressable that fades while pressed.
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  children?: ReactNode;
};

export function Tappable({ style, activeOpacity = 0.6, children, ...rest }: Props) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]}>
      {children}
    </Pressable>
  );
}
