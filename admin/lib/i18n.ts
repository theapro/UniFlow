import "server-only";

const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  uz: () => import("@/dictionaries/uz.json").then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;

export const getDictionary = async (locale: Locale) => {
  if (!dictionaries[locale]) {
    return dictionaries.en();
  }
  return dictionaries[locale]();
};

export const locales: Locale[] = ["en", "uz"];

export const defaultLocale: Locale = "en";
