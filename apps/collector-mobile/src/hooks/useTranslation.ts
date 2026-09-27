import { useCallback } from "react";

import { t as translate, type TranslationKey } from "../i18n";
import { useAppStore } from "../store/appStore";

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language]
  );
  return { language, t };
}
