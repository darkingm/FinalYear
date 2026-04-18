import React from 'react';

const iconFactory = (name: string) => {
  const Icon = (props: any) => React.createElement('svg', { ...props, 'data-icon': name });
  Icon.displayName = name;
  return Icon;
};

export const ChevronLeft = iconFactory('ChevronLeft');
export const ChevronRight = iconFactory('ChevronRight');
export const Expand = iconFactory('Expand');
export const X = iconFactory('X');

const proxy = new Proxy({}, {
  get: (_, key: string) => iconFactory(key),
});

export default proxy;
