// helm - CMS i18n tab switcher. V1: hardcoded ['en','tr'].

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const DEFAULT_LOCALES = ["en", "tr"] as const;
export type LocaleCode = (typeof DEFAULT_LOCALES)[number] | string;

const LABELS: Record<string, string> = {
  en: "English",
  tr: "Turkish",
};

interface Props {
  locales?: readonly string[];
  value: string;
  onChange: (locale: string) => void;
}

export const LocaleSwitcher = ({
  locales = DEFAULT_LOCALES,
  value,
  onChange,
}: Props) => (
  <Tabs value={value} onValueChange={onChange}>
    <TabsList>
      {locales.map((code) => (
        <TabsTrigger key={code} value={code}>
          {LABELS[code] ?? code.toUpperCase()}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
