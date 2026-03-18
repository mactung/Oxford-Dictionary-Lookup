import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import viTranslation from './locales/vi/translation.json';
import hiTranslation from './locales/hi/translation.json';
import arTranslation from './locales/ar/translation.json';
import koTranslation from './locales/ko/translation.json';
import jaTranslation from './locales/ja/translation.json';
import thTranslation from './locales/th/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation
      },
      vi: {
        translation: viTranslation
      },
      hi: {
        translation: hiTranslation
      },
      ar: {
        translation: arTranslation
      },
      ko: {
        translation: koTranslation
      },
      ja: {
        translation: jaTranslation
      },
      th: {
        translation: thTranslation
      }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n;

