import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Radio, ClipboardList, Users,
  Settings, HelpCircle, Menu, X, Sun, Moon, Bell
} from 'lucide-react'
import { useUiStore } from '../stores/uiStore'
import Logo from './Logo'
import ToastContainer from './Toast'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        to: '/' },
  { icon: Radio,           label: 'Active Sessions',  to: '/sessions/active' },
  { icon: ClipboardList,   label: 'Session History',  to: '/sessions/history' },
  { icon: Users,           label: 'Doctors',          to: '/doctors' },
]

const NAV_BOTTOM = [
  { icon: Settings,   label: 'Settings', to: '/settings' },
  { icon: HelpCircle, label: 'Help',     to: '/help' },
]

export default function AppShell() {
  const { sidebarOpen, toggleSidebar, theme, setTheme } = useUiStore()
  const navigate = useNavigate()

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

      <ToastContainer />
    </div>
  )
}
