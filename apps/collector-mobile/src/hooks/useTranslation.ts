import { t } from "../i18n";
import { useAppStore } from "../store/appStore";

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  return { language, t: (key: string) => t(language, key) };
}
