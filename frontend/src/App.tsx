import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { DeveloperHub } from './pages/DeveloperHub';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { RequireAuth } from './components/auth/RequireAuth';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth/login" replace />} />

      <Route path="/auth">
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth allowedRoles={['manager']} />}>
        <Route element={<AppLayout />}>
          <Route path="/manager" element={<ManagerDashboard />} />
        </Route>
      </Route>

      <Route element={<RequireAuth allowedRoles={['developer']} />}>
        <Route element={<AppLayout />}>
          <Route path="/developer" element={<DeveloperHub />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default App;
