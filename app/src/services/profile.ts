// localStorage-backed per-wallet display profile (name + avatar). No backend —
// purely cosmetic, keyed by wallet address so switching wallets shows the right one.

export interface UserProfile {
  name: string;
  avatar: string | null; // small data URL, resized client-side on upload
}

const PROFILES_KEY = 'etfsignal:profiles';
const EMPTY: UserProfile = { name: '', avatar: null };

function readAll(): Record<string, UserProfile> {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function getProfile(address: string | null | undefined): UserProfile {
  if (!address) return EMPTY;
  return readAll()[address.toLowerCase()] ?? EMPTY;
}

export function setProfile(address: string, profile: UserProfile): void {
  const all = readAll();
  all[address.toLowerCase()] = profile;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(all));
}

/** Downscales an uploaded image to a small square JPEG data URL so it fits comfortably in localStorage. */
export function resizeImageToDataUrl(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unsupported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
