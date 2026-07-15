// src/context/LanguageContext.jsx
import { createContext, useContext, useState } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();
export const useLanguage = () => useContext(LanguageContext);

// Tamil is the DEFAULT language for every customer.
// They can switch to English (or any language added later) from the Navbar.
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("ta");

  const t = (key) => translations[lang]?.[key] ?? translations.ta[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
