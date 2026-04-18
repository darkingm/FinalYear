import React from 'react';

const iconFactory = (name: string) => {
  const Icon = (props: React.ComponentProps<'svg'>) =>
    React.createElement('svg', { ...props, 'data-icon': name });
  Icon.displayName = name;
  return Icon;
};

export const ChevronLeft = iconFactory('ChevronLeft');
export const ChevronRight = iconFactory('ChevronRight');
export const Expand = iconFactory('Expand');
export const X = iconFactory('X');
export const AlertCircle = iconFactory('AlertCircle');
export const ArrowLeft = iconFactory('ArrowLeft');
export const ArrowRight = iconFactory('ArrowRight');
export const Calendar = iconFactory('Calendar');
export const Check = iconFactory('Check');
export const CheckCircle = iconFactory('CheckCircle');
export const ChevronDown = iconFactory('ChevronDown');
export const CreditCard = iconFactory('CreditCard');
export const Copy = iconFactory('Copy');
export const ExternalLink = iconFactory('ExternalLink');
export const Eye = iconFactory('Eye');
export const Gem = iconFactory('Gem');
export const Grid3X3 = iconFactory('Grid3X3');
export const Heart = iconFactory('Heart');
export const Info = iconFactory('Info');
export const List = iconFactory('List');
export const Loader2 = iconFactory('Loader2');
export const Lock = iconFactory('Lock');
export const MessageCircle = iconFactory('MessageCircle');
export const Minus = iconFactory('Minus');
export const Package = iconFactory('Package');
export const Plus = iconFactory('Plus');
export const Search = iconFactory('Search');
export const Share2 = iconFactory('Share2');
export const Shield = iconFactory('Shield');
export const ShoppingBag = iconFactory('ShoppingBag');
export const ShoppingCart = iconFactory('ShoppingCart');
export const SlidersHorizontal = iconFactory('SlidersHorizontal');
export const Sparkles = iconFactory('Sparkles');
export const Star = iconFactory('Star');
export const Store = iconFactory('Store');
export const Tag = iconFactory('Tag');
export const TrendingUp = iconFactory('TrendingUp');
export const Trash2 = iconFactory('Trash2');
export const User = iconFactory('User');
export const Wallet = iconFactory('Wallet');
export const Zap = iconFactory('Zap');

const proxy = new Proxy({}, {
  get: (_, key: string) => iconFactory(key),
});

export default proxy;
