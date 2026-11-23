import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ConsoleConfig, ThemeMode } from './config';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  dense: boolean;
  setDense: (dense: boolean) => void;
  dark: boolean;
}
const ThemeContext = createContext<ThemeState | null>(null);
export function ThemeProvider({
  config,
  identity,
  children,
}: {
  config: ConsoleConfig;
  identity: string;
  children: ReactNode;
}) {
  const key = `rancher.console.preferences.${identity}`;
  useEffect(() => {
    document.title = config.branding ? 'Rancher Community Console' : 'Rancher Console';
  }, [config.branding]);
  const [mode, setMode] = useState<ThemeMode>(config.themeDefault);
  const [dense, setDense] = useState(false);
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      setMode(
        config.themeSelectable && ['light', 'dark', 'system'].includes(stored.mode)
          ? stored.mode
          : config.themeDefault,
      );
      setDense(stored.dense === true);
    } catch {
      setMode(config.themeDefault);
      setDense(false);
    }
  }, [key, config]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.themeSwitching = 'true';
    let settledFrame = 0;
    const paintFrame = requestAnimationFrame(() => {
      settledFrame = requestAnimationFrame(() => {
        delete root.dataset.themeSwitching;
      });
    });
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.density = dense ? 'compact' : 'comfortable';
    root.dataset.customCheckboxes = String(config.modules.customCheckboxes === true);
    const overrides = config.customTheme[dark ? 'dark' : 'light'] || {};
    const applied = Object.keys(overrides);
    for (const [token, value] of Object.entries(overrides))
      root.style.setProperty(`--${token}`, value);
    return () => {
      cancelAnimationFrame(paintFrame);
      cancelAnimationFrame(settledFrame);
      delete root.dataset.themeSwitching;
      delete root.dataset.customCheckboxes;
      for (const token of applied) root.style.removeProperty(`--${token}`);
    };
  }, [dark, dense, config]);
  function save(next: ThemeMode, compact: boolean) {
    localStorage.setItem(key, JSON.stringify({ version: 1, mode: next, dense: compact }));
    setMode(next);
    setDense(compact);
  }
  return (
    <ThemeContext
      value={{
        mode,
        setMode: (next) => save(next, dense),
        dense,
        setDense: (next) => save(mode, next),
        dark,
      }}
    >
      {children}
    </ThemeContext>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider ausente');
  return value;
}
