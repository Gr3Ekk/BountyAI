import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';

export function AppLayout() {
  return (
    <div className="relative flex min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white via-white to-muted/40" />
      <div className="pointer-events-none absolute inset-y-0 left-6 -z-10 w-px bg-gradient-to-b from-transparent via-neon-teal/30 to-transparent" />

      <Sidebar />

      <div className="flex flex-1 flex-col">
        <HeaderBar />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
