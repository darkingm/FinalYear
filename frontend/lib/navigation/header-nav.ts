import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Brain,
  Building,
  Fingerprint,
  Home,
  Package,
  PieChart,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { buildLoginRedirectUrl } from '@/lib/auth/login-redirect';

export interface HeaderNavItem {
  href: string;
  /** Translation key used by Header.tsx via t(labelKey). The `label` field is kept as a fallback when i18n hasn't loaded yet. */
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
  icon: LucideIcon;
  authRequired: boolean;
  matchStartsWith?: boolean;
  adminOnly?: boolean;
}

export interface HeaderNavGroup {
  key: 'commerce' | 'finance' | 'account';
  labelKey: string;
  label: string;
  icon: LucideIcon;
  items: HeaderNavItem[];
}

export const HEADER_HOME_ITEM: HeaderNavItem = {
  href: '/',
  labelKey: 'headerNav.home.label',
  label: 'Trang chủ',
  descriptionKey: 'headerNav.home.desc',
  description: 'Tổng quan marketplace',
  icon: Home,
  authRequired: false,
  matchStartsWith: false,
};

const HEADER_NAV_GROUPS: HeaderNavGroup[] = [
  {
    key: 'commerce',
    labelKey: 'headerNav.commerce.label',
    label: 'Mua bán',
    icon: ShoppingBag,
    items: [
      { href: '/products', labelKey: 'headerNav.commerce.products.label', label: 'Sản phẩm', descriptionKey: 'headerNav.commerce.products.desc', description: 'Duyệt danh mục và sản phẩm', icon: Package, authRequired: false },
      { href: '/orders',   labelKey: 'headerNav.commerce.orders.label',   label: 'Đơn hàng', descriptionKey: 'headerNav.commerce.orders.desc',   description: 'Theo dõi và quản lý đơn hàng', icon: ShoppingBag, authRequired: true },
      { href: '/assets',   labelKey: 'headerNav.commerce.rwa.label',      label: 'RWA',      descriptionKey: 'headerNav.commerce.rwa.desc',      description: 'Khám phá tài sản thực được token hóa', icon: Building, authRequired: false },
    ],
  },
  {
    key: 'finance',
    labelKey: 'headerNav.finance.label',
    label: 'Tài chính',
    icon: TrendingUp,
    items: [
      { href: '/trading/BTCUSDT', labelKey: 'headerNav.finance.trading.label',   label: 'Giao dịch',  descriptionKey: 'headerNav.finance.trading.desc',   description: 'Thị trường, chart và biến động giá',     icon: TrendingUp, authRequired: false, matchStartsWith: false },
      { href: '/whale-tracker',   labelKey: 'headerNav.finance.onChain.label',   label: 'On-Chain',   descriptionKey: 'headerNav.finance.onChain.desc',   description: 'Theo dõi dòng tiền và tín hiệu on-chain', icon: Activity,   authRequired: false },
      { href: '/portfolio',       labelKey: 'headerNav.finance.portfolio.label', label: 'Portfolio',  descriptionKey: 'headerNav.finance.portfolio.desc', description: 'Danh mục đầu tư RWA của bạn',            icon: PieChart,   authRequired: true },
    ],
  },
  {
    key: 'account',
    labelKey: 'headerNav.account.label',
    label: 'Tài khoản',
    icon: User,
    items: [
      { href: '/wallet',           labelKey: 'headerNav.account.wallet.label',  label: 'Ví',                descriptionKey: 'headerNav.account.wallet.desc',  description: 'Số dư, nạp rút và kết nối Web3',     icon: Wallet,      authRequired: true },
      { href: '/kyc',              labelKey: 'headerNav.account.kyc.label',     label: 'Xác minh KYC',      descriptionKey: 'headerNav.account.kyc.desc',     description: 'Xác minh danh tính để đầu tư RWA',   icon: Fingerprint, authRequired: true },
      { href: '/profile',          labelKey: 'headerNav.account.profile.label', label: 'Hồ sơ',             descriptionKey: 'headerNav.account.profile.desc', description: 'Thông tin và thiết lập tài khoản',   icon: User,        authRequired: true },
      { href: '/profile/credit',   labelKey: 'headerNav.account.credit.label',  label: 'AI Credit',         descriptionKey: 'headerNav.account.credit.desc',  description: 'Quản lý credit và quyền dùng AI',    icon: Brain,       authRequired: true },
      { href: '/seller/dashboard', labelKey: 'headerNav.account.seller.label',  label: 'Seller Dashboard', descriptionKey: 'headerNav.account.seller.desc',  description: 'Bảng điều khiển dành cho người bán', icon: BarChart3,   authRequired: true },
      { href: '/admin',            labelKey: 'headerNav.account.admin.label',   label: 'Admin',             descriptionKey: 'headerNav.account.admin.desc',   description: 'Vận hành và quản trị hệ thống',      icon: Building,    authRequired: true, adminOnly: true },
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

  return buildLoginRedirectUrl(item.href);
}
