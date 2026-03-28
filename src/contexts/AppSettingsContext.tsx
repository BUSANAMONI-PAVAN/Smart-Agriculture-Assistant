import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type AppSettingsContextType = {
  simpleMode: boolean;
  setSimpleMode: (value: boolean) => void;
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [simpleMode, setSimpleModeState] = useState<boolean>(() => localStorage.getItem('simpleMode') === 'true');

  const setSimpleMode = (value: boolean) => {
    setSimpleModeState(value);
    localStorage.setItem('simpleMode', String(value));
  };

  const value = useMemo(() => ({ simpleMode, setSimpleMode }), [simpleMode]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }
  return context;
}