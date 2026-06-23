import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import SideBar from './SideBar';

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-on-surface relative overflow-x-hidden">
      {/* Ambient Gradient Blobs */}
      <div className="ambient-blob blob-1" />
      <div className="ambient-blob blob-2" />
      <div className="ambient-blob blob-3" />
      {/* Desktop Sidebar */}
      <SideBar />

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-32 md:pt-14 md:pb-14 md:pl-20 transition-all duration-300">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <NavBar />
    </div>
  );
}
