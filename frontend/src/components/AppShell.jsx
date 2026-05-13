import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Radio, ClipboardList, Users,
  Settings, HelpCircle, Menu, X, Sun, Moon, Bell,
  PlusCircle, Clock, BarChart2
} from 'lucide-react'
import { useUiStore } from '../stores/uiStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import Logo from './Logo'
import ToastContainer from './Toast'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        to: '/' },
  { icon: Radio,           label: 'Active Sessions',  to: '/sessions/active' },
  { icon: ClipboardList,   label: 'Session History',  to: '/sessions/history' },
  { icon: Users,           label: 'Doctors',          to: '/doctors' },
  { icon: BarChart2,       label: 'Analytics',        to: '/analytics' },
]

const NAV_BOTTOM = [
  { icon: Settings,   label: 'Settings', to: '/settings' },
  { icon: HelpCircle, label: 'Help',     to: '/help' },
]

const BOTTOM_TABS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: PlusCircle,      label: 'New',       to: '/sessions/new', accent: true },
  { icon: Clock,           label: 'History',   to: '/sessions/history' },
  { icon: Users,           label: 'Doctors',   to: '/doctors' },
  { icon: Settings,        label: 'Settings',  to: '/settings' },
]

export default function AppShell() {
  const { sidebarOpen, toggleSidebar, theme, setTheme } = useUiStore()
  const navigate = useNavigate()
  const [showShortcuts, setShowShortcuts] = useState(false)

  useKeyboardShortcuts()

  useEffect(() => {
    const showHandler = () => setShowShortcuts(true)
    const escHandler = () => setShowShortcuts(false)
    window.addEventListener('mediscribe:show-shortcuts', showHandler)
    window.addEventListener('mediscribe:escape', escHandler)
    return () => {
      window.removeEventListener('mediscribe:show-shortcuts', showHandler)
      window.removeEventListener('mediscribe:escape', escHandler)
    }
  }, [])

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <div className={`${styles.shell} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.logoBtn} onClick={() => navigate('/')} aria-label="Go to dashboard">
            <Logo size={28} />
            <span className={styles.logoText}>MediScribe</span>
          </button>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                  onClick={() => { if (window.innerWidth < 768) toggleSidebar() }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className={styles.navDivider} />

          <ul className={styles.navList}>
            {NAV_BOTTOM.map(({ icon: Icon, label, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Topbar */}
      <header className={styles.topbar}>
        <button
          className={styles.hamburger}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className={styles.topbarRight}>
          <span className="topbar-shortcut-hint">Press ? for shortcuts</span>
          <button
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className={styles.iconBtn} aria-label="Notifications">
            <Bell size={16} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className={styles.bottomTabs} aria-label="Main navigation">
        {BOTTOM_TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `${styles.bottomTab}${isActive ? ` ${styles.bottomTabActive}` : ''}${tab.accent ? ` ${styles.bottomTabAccent}` : ''}`
            }
          >
            <tab.icon size={20} />
            <span className={styles.bottomTabLabel}>{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      <ToastContainer />

      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Keyboard Shortcuts</h2>
            <table className="shortcuts-table">
              <tbody>
                <tr><td><kbd>N</kbd></td><td>New Session</td></tr>
                <tr><td><kbd>H</kbd></td><td>Session History</td></tr>
                <tr><td><kbd>D</kbd></td><td>Dashboard</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Close modal / Cancel</td></tr>
                <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
              </tbody>
            </table>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowShortcuts(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
