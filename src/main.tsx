import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { repository } from './infrastructure/repository';
import './style.css';
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Application root unavailable');
const root = createRoot(rootElement);
if (!globalThis.indexedDB || !globalThis.File || !globalThis.crypto?.randomUUID) {
  root.render(
    <main className="fatal">
      <h1>Browser support required</h1>
      <p>
        Open FinTrack in a current browser with IndexedDB, File API and secure Web Crypto support
        enabled.
      </p>
    </main>,
  );
} else {
  root.render(<p role="status">Opening your local workspace…</p>);
  repository
    .initialize()
    .then(() =>
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      ),
    )
    .catch(() =>
      root.render(
        <main className="fatal">
          <h1>Local storage could not be opened</h1>
          <p>Enable storage for this site and reload. Your existing data has not been removed.</p>
          <button onClick={() => location.reload()}>Try again</button>
        </main>,
      ),
    );
}
