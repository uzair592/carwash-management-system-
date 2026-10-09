import React, { useEffect, useState } from 'react';
import { CloudDownload, Download } from 'lucide-react';
import { connection, setOfflineSaving, saveLatest } from '../offline';

export default function AppConnection() {
  const [state, setState] = useState(connection);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const update = event => setState(event.detail);
    const captureInstall = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('dfpro-connection', update);
    window.addEventListener('beforeinstallprompt', captureInstall);
    return () => {
      window.removeEventListener('dfpro-connection', update);
      window.removeEventListener('beforeinstallprompt', captureInstall);
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      if (!state.persist) await setOfflineSaving(true);
      await saveLatest();
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || 'Offline saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const lastSync = state.lastSync
    ? new Date(state.lastSync).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'short',
      timeStyle: 'short'
    })
    : null;
  const status = state.offline
    ? 'Offline — saved data'
    : saving
      ? 'Saving offline data…'
      : saved
        ? 'Saved for offline'
        : 'Save latest for offline';

  return (
    <div className={`sidebar-offline ${state.offline ? 'offline' : ''}`}>
      <button
        className="nav-item sidebar-offline-action"
        disabled={saving || state.offline}
        onClick={save}
        title={lastSync ? `Last synced ${lastSync}` : 'Save shop data on this device'}
      >
        <CloudDownload size={19} />
        <span>{status}</span>
        <i aria-hidden="true" />
      </button>
      {state.offline && (
        <p role="status">Last synced {lastSync || 'time unavailable'}</p>
      )}
      {(saved || error || state.storageError) && (
        <p role="status">{state.storageError || error || 'Offline copy updated.'}</p>
      )}
      {installPrompt && (
        <button
          className="nav-item sidebar-install-action"
          onClick={async () => {
            await installPrompt.prompt();
            setInstallPrompt(null);
          }}
        >
          <Download size={19} />
          <span>Install app</span>
        </button>
      )}
    </div>
  );
}
