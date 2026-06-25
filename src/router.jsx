import { createBrowserRouter, Navigate } from 'react-router-dom';
import { getConsentForCurrentUser, getCurrentUser } from './lib/store';

// Layout
import AppShell from './components/layout/AppShell';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ConsentPage from './pages/auth/ConsentPage';

// Student Pages
import HomePage from './pages/student/HomePage';
import ProjectsListPage from './pages/student/ProjectsListPage';
import ProposalPage from './pages/student/ProposalPage';
import CheckpointsPage from './pages/student/CheckpointsPage';
import UploadPage from './pages/student/UploadPage';
import LogPage from './pages/student/LogPage';
import ReportPage from './pages/student/ReportPage';
import AssignmentsListPage from './pages/student/AssignmentsListPage';
import AssignmentDetailPage from './pages/student/AssignmentDetailPage';

// Teacher Pages
import DashboardPage from './pages/teacher/DashboardPage';
import ProjectDetailPage from './pages/teacher/ProjectDetailPage';
import ScoringPage from './pages/teacher/ScoringPage';
import TeacherAssignmentsPage from './pages/teacher/AssignmentsPage';
import CreateAssignmentPage from './pages/teacher/CreateAssignmentPage';
import TeacherAssignmentDetailPage from './pages/teacher/TeacherAssignmentDetailPage';
import EditAssignmentPage from './pages/teacher/EditAssignmentPage';

// Shared
import ProfilePage from './pages/SettingsPage';
import DeveloperPage from './pages/dev/DeveloperPage';

// Auth Guard component
const RequireAuth = ({ children, requireRole, requireConsent = true }) => {
  const user = getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    // Redirect each role to its home
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user.role === 'dev') return <Navigate to="/dev" replace />;
    return <Navigate to="/" replace />;
  }

  if (requireConsent && user.role === 'student' && !getConsentForCurrentUser()) {
    return <Navigate to="/consent" replace />;
  }

  return children;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/consent',
    element: <RequireAuth requireRole="student" requireConsent={false}><ConsentPage /></RequireAuth>,
  },
  {
    path: '/',
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      // Student Routes
      { index: true, element: <RequireAuth requireRole="student"><HomePage /></RequireAuth> },
      { path: 'assignments', element: <RequireAuth requireRole="student"><AssignmentsListPage /></RequireAuth> },
      { path: 'assignments/:assignmentId', element: <RequireAuth requireRole="student"><AssignmentDetailPage /></RequireAuth> },
      { path: 'assignments/:assignmentId/new-project', element: <RequireAuth requireRole="student"><ProposalPage /></RequireAuth> },
      { path: 'projects', element: <RequireAuth requireRole="student"><ProjectsListPage /></RequireAuth> },
      { path: 'projects/new', element: <RequireAuth requireRole="student"><ProposalPage /></RequireAuth> },
      { path: 'projects/:projectId/checkpoints', element: <RequireAuth requireRole="student"><CheckpointsPage /></RequireAuth> },
      { path: 'upload', element: <RequireAuth requireRole="student"><UploadPage /></RequireAuth> },
      { path: 'log', element: <RequireAuth requireRole="student"><LogPage /></RequireAuth> },
      { path: 'report/:projectId', element: <RequireAuth requireRole="student"><ReportPage /></RequireAuth> },

      // Teacher Routes
      { path: 'teacher', element: <Navigate to="/teacher/dashboard" replace /> },
      { path: 'teacher/dashboard', element: <RequireAuth requireRole="teacher"><DashboardPage /></RequireAuth> },
      { path: 'teacher/assignments', element: <RequireAuth requireRole="teacher"><TeacherAssignmentsPage /></RequireAuth> },
      { path: 'teacher/assignments/new', element: <RequireAuth requireRole="teacher"><CreateAssignmentPage /></RequireAuth> },
      { path: 'teacher/assignments/:assignmentId', element: <RequireAuth requireRole="teacher"><TeacherAssignmentDetailPage /></RequireAuth> },
      { path: 'teacher/assignments/:assignmentId/edit', element: <RequireAuth requireRole="teacher"><EditAssignmentPage /></RequireAuth> },
      { path: 'teacher/projects/:projectId', element: <RequireAuth requireRole="teacher"><ProjectDetailPage /></RequireAuth> },
      { path: 'teacher/projects/:projectId/score', element: <RequireAuth requireRole="teacher"><ScoringPage /></RequireAuth> },

      // Shared Routes
      { path: 'profile', element: <ProfilePage /> },
      
      // Dev Routes
      { path: 'dev', element: <RequireAuth requireRole="dev"><DeveloperPage /></RequireAuth> },
    ],
  },
]);
