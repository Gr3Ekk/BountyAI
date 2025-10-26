import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { ManagerAICopilot } from './pages/ManagerAICopilot';
import { ManagerSideBounties } from './pages/ManagerSideBounties';
import { TeamAssignmentView } from './pages/TeamAssignmentView';
import { DeveloperHub } from './pages/DeveloperHub';
import { DeveloperSideBounties } from './pages/DeveloperSideBounties';
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
          <Route path="/manager/steve" element={<ManagerAICopilot />} />
          <Route path="/manager/ai-copilot" element={<Navigate to="/manager/steve" replace />} />
          <Route path="/manager/copilot" element={<Navigate to="/manager/steve" replace />} />
          <Route path="/manager/assignment/:assignmentId" element={<TeamAssignmentView />} />
          <Route path="/manager/side-bounties" element={<ManagerSideBounties />} />
        </Route>
      </Route>

      <Route element={<RequireAuth allowedRoles={['developer']} />}>
        <Route element={<AppLayout />}>
          <Route path="/developer" element={<DeveloperHub />} />
          <Route path="/developer/side-bounties" element={<DeveloperSideBounties />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default App;
