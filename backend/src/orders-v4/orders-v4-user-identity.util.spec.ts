import { ordersV4UsernameFromEmail } from './orders-v4-user-identity.util';

describe('ordersV4UsernameFromEmail', () => {
  it('returns only the username portion and never exposes the email domain', () => {
    expect(ordersV4UsernameFromEmail(' ahmed@hajrix.com ')).toBe('ahmed');
    expect(ordersV4UsernameFromEmail('cashier')).toBe('cashier');
    expect(ordersV4UsernameFromEmail(null)).toBeNull();
  });
});
