export function notificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState() {
  return notificationSupport() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!notificationSupport()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showNotification(title, options = {}) {
  if (permissionState() !== 'granted') return false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    } catch {
      // fall through to the page constructor
    }
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
