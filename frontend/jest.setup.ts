import '@testing-library/jest-dom';
import React from 'react';
import { jest } from '@jest/globals';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, priority, unoptimized, ...rest } = props;
    return React.createElement('img', rest);
  },
}));

const mockGradient = {
  addColorStop: jest.fn(),
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => ({
    setTransform: jest.fn(),
    fillRect: jest.fn(),
    createLinearGradient: jest.fn(() => mockGradient),
    createRadialGradient: jest.fn(() => mockGradient),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    stroke: jest.fn(),
    ellipse: jest.fn(),
    clearRect: jest.fn(),
  })),
});
