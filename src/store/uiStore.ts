import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, type Lang, type TranslationKey } from '@/lib/i18n';

interface UIState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
      t: (key) => translations[get().lang][key] as string,
    }),
    { name: 'flowcraft-ui' }
  )
);
