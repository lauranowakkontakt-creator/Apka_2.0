import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Konfiguracja ESLint.
//
// Powód, dla którego to tu jest: dzielenie dużych komponentów na mniejsze pliki
// jest bezpieczne tylko wtedy, gdy coś pilnuje importów. Vite zbuduje bez
// mrugnięcia kod, który używa nieistniejącej zmiennej — błąd wyjdzie dopiero
// w przeglądarce, u użytkownika. `no-undef` łapie to od razu.
//
// Reguł jest celowo mało. To nie ma być narzędzie do czepiania się stylu —
// od tego są oczy przy code review. Zostają te, które wskazują realne błędy.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'Wyglad/**', 'public/**', 'dev-dist/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      // Sedno sprawy: użycie nieistniejącej zmiennej.
      'no-undef': 'error',
      // JSX liczy się jako użycie komponentu — bez tego każdy zaimportowany
      // komponent wyglądałby na nieużywany.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',   // nowy transform JSX, React niepotrzebny w zakresie
      'react/jsx-no-undef': 'error',   // <Komponent /> bez importu

      // Zasady hooków. Naruszenie tych dwóch daje błędy, których szuka się
      // godzinami: stan wyciekający między renderami albo efekt gubiący
      // zależność i nieodświeżający danych.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Nieużywane rzeczy to zwykle pozostałość po refaktorze. Ostrzeżenie,
      // nie błąd — nie ma sensu blokować pushu przez zapomnianą zmienną.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // Puste `catch {}` jest w tej apce świadomym wzorcem (localStorage,
        // clipboard) — komentarz przy każdym tłumaczy dlaczego.
        caughtErrors: 'none',
      }],

      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  {
    files: ['test/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': 'warn',
      // Testy wykrywające emotki celowo trzymają w klasie znaków selektor
      // wariantu (U+FE0F) i inne znaki łączące — o to właśnie chodzi, żeby je
      // wyłapać. Reguła zakłada, że to pomyłka; tutaj nie jest.
      'no-misleading-character-class': 'off',
    },
  },

  // Testy przeglądarkowe: funkcje przekazywane do page.evaluate() działają
  // w przeglądarce, więc mają jej zmienne (document, innerWidth…).
  {
    files: ['test/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
