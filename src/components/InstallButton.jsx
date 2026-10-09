import { useEffect, useState } from 'react';

export default function InstallButton({ className = 'btn btn-outline' }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true
  );
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (installed) return <p className="hint install-hint">MedRem is installed on this device.</p>;

  if (deferred) {
    return (
      <button type="button" className={className} onClick={install}>
        Download app to this phone
      </button>
    );
  }

  if (isIOS) {
    return (
      <p className="hint install-hint">
        To download: open the <strong>Share</strong> menu → <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  return (
    <p className="hint install-hint">
      To download: open your browser menu → <strong>Install app</strong> /{' '}
      <strong>Add to Home screen</strong>.
    </p>
  );
}
