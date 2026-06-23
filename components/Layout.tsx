import { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { FiUpload, FiGrid, FiLogOut, FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import NotificationBell from './NotificationBell';
import logoSvg from '../assets/logo.svg';

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
              <img src={logoSvg} alt="EnigmaShare" className="w-8 h-8" />
              <span className="font-heading text-lg font-semibold tracking-tight">EnigmaShare</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <FiGrid className="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    to="/share/new"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <FiUpload className="w-4 h-4" />
                    New Share
                  </Link>
                  <NotificationBell />
                  <div className="h-5 w-px bg-border mx-2" />
                  <span className="text-sm text-foreground/50 truncate max-w-[150px] px-2">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
                  >
                    <FiLogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-85 transition-all duration-200 cursor-pointer"
                >
                  Sign In
                </Link>
              )}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer ml-1"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
              </button>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-2">
              {user && <NotificationBell />}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-foreground/50 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <FiGrid className="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    to="/share/new"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <FiUpload className="w-4 h-4" />
                    New Share
                  </Link>
                  <div className="px-3 py-2 text-xs text-foreground/40 truncate">{user.email}</div>
                  <button
                    onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full cursor-pointer"
                  >
                    <FiLogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium transition-all duration-200"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3">
              <img src={logoSvg} alt="EnigmaShare" className="w-7 h-7" />
              <span className="font-heading text-sm font-semibold">EnigmaShare</span>
            <p className="text-xs text-foreground/40 text-center max-w-md">
              End-to-end encrypted file sharing — zero-knowledge, total privacy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
