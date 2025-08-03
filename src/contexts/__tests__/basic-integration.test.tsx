import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppProvider, useAppContext, useAppActions, useAppStatus } from '../AppContext';

// Mock WebSocket and SpeechSynthesis APIs
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
}));

global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
} as any;

// Test component that uses all context hooks
function TestComponent() {
  const appContext = useAppContext();
  const appActions = useAppActions();
  const appStatus = useAppStatus();

  return (
    <div>
      <div data-testid="context-loaded">
        {appContext ? 'loaded' : 'not-loaded'}
      </div>
      <div data-testid="actions-available">
        {typeof appActions.connectToChat === 'function' ? 'available' : 'not-available'}
      </div>
      <div data-testid="status-available">
        {typeof appStatus.isConnectedToChat === 'boolean' ? 'available' : 'not-available'}
      </div>
    </div>
  );
}

describe('Context Integration', () => {
  it('should provide all context values without errors', () => {
    const { getByTestId } = render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    // Check that contexts are loaded
    expect(getByTestId('context-loaded').textContent).toBe('loaded');
    expect(getByTestId('actions-available').textContent).toBe('available');
    expect(getByTestId('status-available').textContent).toBe('available');
  });

  it('should handle custom props without errors', () => {
    const { getByTestId } = render(
      <AppProvider 
        channel="testchannel" 
        maxMessages={50}
        initialTTSSettings={{ enabled: true, volume: 0.5 }}
      >
        <TestComponent />
      </AppProvider>
    );

    // Should render without errors
    expect(getByTestId('context-loaded').textContent).toBe('loaded');
  });

  it('should throw error when hooks are used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow();

    consoleSpy.mockRestore();
  });
});