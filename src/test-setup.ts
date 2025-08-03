import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock scrollIntoView globally
Element.prototype.scrollIntoView = vi.fn();

// Mock CSS imports
vi.mock('*.css', () => ({}));