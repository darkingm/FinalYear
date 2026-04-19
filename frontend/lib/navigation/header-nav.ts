import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Brain,
  Building,
  Home,
  Package,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';

export interface HeaderNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  authRequired: boolean;
  matchStartsWith?: boolean;
  adminOnly?: boolean;
}

export interface HeaderNavGroup {
  key: 'commerce' | 'finance' | 'account';
  label: string;
  icon: LucideIcon;
  items: HeaderNavItem[];
}

export const HEADER_HOME_ITEM: HeaderNavItem = {
  href: '/',
  label: 'Trang chủ',
  description: 'Tổng quan marketplace',
  icon: Home,
  authRequired: false,
  matchStartsWith: false,
};

const HEADER_NAV_GROUPS: HeaderNavGroup[] = [
  {
    key: 'commerce',
    label: 'Mua bán',
    icon: ShoppingBag,
    items: [
      { href: '/products', label: 'Sản phẩm', description: 'Duyệt danh mục và sản phẩm', icon: Package, authRequired: false },
      { href: '/orders', label: 'Đơn hàng', description: 'Theo dõi và quản lý đơn hàng', icon: ShoppingBag, authRequired: true },
      { href: '/assets', label: 'RWA', description: 'Khám phá tài sản thực được token hóa', icon: Building, authRequired: false },
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính',
    icon: TrendingUp,
    items: [
      { href: '/trading/BTCUSDT', label: 'Giao dịch', description: 'Thị trường, chart và biến động giá', icon: TrendingUp, authRequired: false, matchStartsWith: false },
      { href: '/whale-tracker', label: 'On-Chain', description: 'Theo dõi dòng tiền và tín hiệu on-chain', icon: Activity, authRequired: false },
    ],
  },
  {
    key: 'account',
    label: 'Tài khoản',
    icon: User,
    items: [
      { href: '/wallet', label: 'Ví', description: 'Số dư, nạp rút và kết nối Web3', icon: Wallet, authRequired: true },
      { href: '/profile', label: 'Hồ sơ', description: 'Thông tin và thiết lập tài khoản', icon: User, authRequired: true },
      { href: '/profile/credit', label: 'AI Credit', description: 'Quản lý credit và quyền dùng AI', icon: Brain, authRequired: true },
      { href: '/seller/dashboard', label: 'Seller Dashboard', description: 'Bảng điều khiển dành cho người bán', icon: BarChart3, authRequired: true },
      { href: '/admin', label: 'Admin', description: 'Vận hành và quản trị hệ thống', icon: Building, authRequired: true, adminOnly: true },
    ],
  },
];

function matchesHeaderNavItem(item: HeaderNavItem, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (item.href === '/') return pathname === '/';
  if (item.matchStartsWith === false) return pathname === item.href;
  return pathname.startsWith(item.href);
}

export function buildHeaderNavGroups(options: { isAdmin: boolean }): HeaderNavGroup[] {
  return HEADER_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || options.isAdmin),
  }));
}

export function isHeaderNavGroupActive(group: HeaderNavGroup, pathname: string | null | undefined): boolean {
  return group.items.some((item) => matchesHeaderNavItem(item, pathname));
}

export function isHeaderNavItemActive(item: HeaderNavItem, pathname: string | null | undefined): boolean {
  return matchesHeaderNavItem(item, pathname);
}

export function resolveHeaderNavHref(item: HeaderNavItem, isAuthenticated: boolean): string {
  if (!item.authRequired || isAuthenticated) {
    return item.href;
  }

  return `/login?callbackUrl=${encodeURIComponent(item.href)}`;
}
