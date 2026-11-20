import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './lib/i18n.tsx';
import './index.css';

const hasOAuthPayload =
  typeof window !== 'undefined' &&
  Boolean(window.opener && window.opener !== window) &&
  (window.location.hash.includes('access_token=') ||
    window.location.hash.includes('error=') ||
    window.location.search.includes('code=') ||
    window.location.search.includes('error='));

if (hasOAuthPayload) {
  const payload = {
    type: 'SEARCHLINK_OAUTH_RESULT',
    hash: window.location.hash || '',
    search: window.location.search || '',
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('searchlink-oauth');
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignore channel errors
  }
  try {
    window.opener?.postMessage(payload, window.location.origin);
  } catch {
    // Ignore origin-scoped errors
  }
  try {
    window.opener?.postMessage(payload, '*');
  } catch {
    // Ignore wildcard postMessage errors
  }
  window.close();
} else {
  createRoot(document.getElementById('root')!).render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}
