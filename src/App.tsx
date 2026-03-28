import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ReactNode } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { AppSettingsProvider, useAppSettings } from './contexts/AppSettingsContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Header } from './components/Header';
import { GlossyBackdrop } from './components/GlossyBackdrop';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Weather } from './pages/Weather';
import { CropRecommend } from './pages/CropRecommend';
import { DiseaseDetect } from './pages/DiseaseDetect';
import { FarmingTips } from './pages/FarmingTips';
import { MarketPrices } from './pages/MarketPrices';
import { FertilizerCalc } from './pages/FertilizerCalc';
import { GovtSchemes } from './pages/GovtSchemes';
import { Profile } from './pages/Profile';
import { ProfitEstimator } from './pages/ProfitEstimator';
import { AdminPanel } from './pages/AdminPanel';
import { NotificationsDebug } from './pages/NotificationsDebug';
import { AIAssistant } from './pages/AIAssistant';

function AppFrame({ children }: { children: ReactNode }) {
  return <div className="app-frame animate-float-in">{children}</div>;
}

function AppShell() {
  const { simpleMode } = useAppSettings();

  return (
    <Router>
      <div className={`glossy-app min-h-screen bg-[radial-gradient(circle_at_top,#f7f8ff_0%,#edf2f7_34%,#efe8f4_62%,#f7efe8_100%)] flex flex-col ${simpleMode ? 'simple-mode' : ''}`}>
        <GlossyBackdrop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppFrame>
                  <Header />
                  <Dashboard />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppFrame>
                  <Header />
                  <Dashboard />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute featureKey="farmerProfile">
                <AppFrame>
                  <Header />
                  <Profile />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/weather"
            element={
              <ProtectedRoute featureKey="weather">
                <AppFrame>
                  <Header />
                  <Weather />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/crop-recommend"
            element={
              <ProtectedRoute featureKey="cropRecommendation">
                <AppFrame>
                  <Header />
                  <CropRecommend />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/disease-detect"
            element={
              <ProtectedRoute featureKey="diseaseDetection">
                <AppFrame>
                  <Header />
                  <DiseaseDetect />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/farming-tips"
            element={
              <ProtectedRoute>
                <AppFrame>
                  <Header />
                  <FarmingTips />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/market-prices"
            element={
              <ProtectedRoute featureKey="marketPrices">
                <AppFrame>
                  <Header />
                  <MarketPrices />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profit-estimator"
            element={
              <ProtectedRoute featureKey="profitEstimator">
                <AppFrame>
                  <Header />
                  <ProfitEstimator />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/fertilizer-calc"
            element={
              <ProtectedRoute featureKey="fertilizerCalculator">
                <AppFrame>
                  <Header />
                  <FertilizerCalc />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute>
                <AppFrame>
                  <Header />
                  <AIAssistant />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/govt-schemes"
            element={
              <ProtectedRoute featureKey="govtSchemes">
                <AppFrame>
                  <Header />
                  <GovtSchemes />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AppFrame>
                  <Header />
                  <AdminPanel />
                </AppFrame>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/notifications-debug"
            element={
              <ProtectedRoute roles={['admin']} featureKey="notificationsDebug">
                <AppFrame>
                  <Header />
                  <NotificationsDebug />
                </AppFrame>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppSettingsProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppShell />
          </NotificationProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </LanguageProvider>
  );
}

export default App;
