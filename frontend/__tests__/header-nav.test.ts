import { describe, expect, it } from '@jest/globals';
import {
  buildHeaderNavGroups,
  HEADER_HOME_ITEM,
  isHeaderNavGroupActive,
  isHeaderNavItemActive,
  resolveHeaderNavHref,
} from '@/lib/navigation/header-nav';

describe('header navigation groups', () => {
  it('builds the three approved desktop groups', () => {
    const groups = buildHeaderNavGroups({ isAdmin: false });

    expect(groups.map((group) => group.label)).toEqual(['Mua bán', 'Tài chính', 'Tài khoản']);
    expect(groups[0].items.map((item) => item.href)).toEqual(['/products', '/orders', '/assets']);
    expect(groups[1].items.map((item) => item.href)).toEqual(['/trading/BTCUSDT', '/whale-tracker', '/portfolio']);
    expect(groups[2].items.map((item) => item.href)).toContain('/wallet');
    expect(groups[2].items.map((item) => item.href)).toContain('/kyc');
  });

  it('marks a group active when the current route belongs to one of its items', () => {
    const groups = buildHeaderNavGroups({ isAdmin: false });
    const commerceGroup = groups[0];

    expect(isHeaderNavGroupActive(commerceGroup, '/orders/123')).toBe(true);
    expect(isHeaderNavGroupActive(commerceGroup, '/wallet')).toBe(false);
  });

  it('redirects auth-protected items to login when the user is signed out', () => {
    const groups = buildHeaderNavGroups({ isAdmin: false });
    const accountGroup = groups[2];
    const creditItem = accountGroup.items.find((item) => item.href === '/profile/credit');

    expect(resolveHeaderNavHref(creditItem!, false)).toBe('/login?callbackUrl=%2Fprofile%2Fcredit');
    expect(resolveHeaderNavHref(creditItem!, true)).toBe('/profile/credit');
  });

  it('includes the admin item only for admins', () => {
    const regularGroups = buildHeaderNavGroups({ isAdmin: false });
    const adminGroups = buildHeaderNavGroups({ isAdmin: true });

    expect(regularGroups[2].items.some((item) => item.href === '/admin')).toBe(false);
    expect(adminGroups[2].items.some((item) => item.href === '/admin')).toBe(true);
  });

  it('keeps Trang chu as a standalone nav item outside grouped menus', () => {
    expect(HEADER_HOME_ITEM.href).toBe('/');
    expect(isHeaderNavItemActive(HEADER_HOME_ITEM, '/')).toBe(true);
    expect(isHeaderNavItemActive(HEADER_HOME_ITEM, '/products')).toBe(false);
  });
});
