import { Component, lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Upload,
  BadgeDollarSign,
  Repeat2,
  TrendingUp,
  ChartNoAxesCombined,
  Settings,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import { Loading } from '../shared/components';
import Dashboard from '../features/Dashboard';
import Accounts from '../features/Accounts';
import Transactions from '../features/Transactions';
import Budgets from '../features/Budgets';
import Subscriptions from '../features/Subscriptions';
import Categories from '../features/Categories';
const Imports = lazy(() => import('../features/Imports'));
const Forecast = lazy(() => import('../features/Forecast'));
const Reports = lazy(() => import('../features/Reports'));
const DataSettings = lazy(() => import('../features/Settings'));
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal">
          <h1>FinTrack could not open this view.</h1>
          <p>
            Your local data has not been deleted. Refresh the application or return to the
            dashboard.
          </p>
          <button onClick={() => window.location.reload()}>Refresh application</button>
          <a className="button secondary" href={import.meta.env.BASE_URL}>
            Dashboard
          </a>
        </main>
      );
    return this.props.children;
  }
}
const navigation = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/transactions', 'Transactions', ArrowLeftRight],
  ['/accounts', 'Accounts', Wallet],
  ['/import', 'Import', Upload],
  ['/categories', 'Categories & rules', Tags],
  ['/budgets', 'Budgets', BadgeDollarSign],
  ['/subscriptions', 'Subscriptions', Repeat2],
  ['/forecast', 'Forecast', TrendingUp],
  ['/reports', 'Reports', ChartNoAxesCombined],
  ['/settings', 'Settings', Settings],
] as const;
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById('main-content')?.focus();
          }}
        >
          Skip to content
        </a>
        <div className="app-shell">
          <aside className="sidebar">
            <Link to="/" className="brand">
              <span className="brand-mark">F</span>FinTrack
              <span className="local-badge">LOCAL</span>
            </Link>
            <p className="nav-label">WORKSPACE</p>
            <nav aria-label="Main navigation">
              {navigation.map(([path, label, Icon]) => (
                <NavLink key={path} to={path} end={path === '/'}>
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="privacy">
              <ShieldCheck size={22} aria-hidden="true" />
              <strong>Private by design</strong>
              <p>
                Your financial data stays in your browser. FinTrack does not upload transaction
                history to a server.
              </p>
            </div>
          </aside>
          <main id="main-content" tabIndex={-1}>
            <div className="topbar">
              <span>Personal workspace</span>
              <span className="storage-label">
                <ShieldCheck size={16} aria-hidden="true" /> Stored on this device
              </span>
            </div>
            <div className="page">
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/import" element={<Imports />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/budgets" element={<Budgets />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/forecast" element={<Forecast />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<DataSettings />} />
                  <Route
                    path="*"
                    element={
                      <>
                        <h1>Page not found</h1>
                        <Link to="/">Return to dashboard</Link>
                      </>
                    }
                  />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
}
