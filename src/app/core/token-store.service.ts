import { Injectable } from '@angular/core';

const STORAGE_KEY = 'birthday-invitation-recovery-token';

@Injectable({ providedIn: 'root' })
export class TokenStoreService {
  getOrCreate(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && this.isValid(saved)) return saved;
      const token = this.createToken();
      localStorage.setItem(STORAGE_KEY, token);
      return token;
    } catch {
      return this.createToken();
    }
  }

  private createToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private isValid(value: string): boolean {
    return /^[a-f0-9]{64}$/.test(value);
  }
}
