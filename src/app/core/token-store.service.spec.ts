import { describe, expect, it, beforeEach } from 'vitest';
import { TokenStoreService } from './token-store.service';

describe('TokenStoreService', () => {
  beforeEach(() => localStorage.clear());

  it('creates a cryptographically sized local recovery token', () => {
    const token = new TokenStoreService().getOrCreate();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(localStorage.getItem('birthday-invitation-recovery-token')).toBe(token);
  });

  it('reuses a valid token to recover the same RSVP', () => {
    const service = new TokenStoreService();
    const first = service.getOrCreate();
    expect(service.getOrCreate()).toBe(first);
  });

  it('replaces malformed local data instead of sending it to the backend', () => {
    localStorage.setItem('birthday-invitation-recovery-token', '<script>bad</script>');
    expect(new TokenStoreService().getOrCreate()).toMatch(/^[a-f0-9]{64}$/);
  });
});
