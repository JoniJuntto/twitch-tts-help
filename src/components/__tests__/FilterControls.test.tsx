import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterControls } from '../FilterControls';
import { TTSProvider } from '../../contexts/TTSContext';
import type { TTSSettings } from '../../types';

// Mock the TTS services
vi.mock('../../services/TTSService', () => ({
  TTSService: vi.fn().mockImplementation(() => ({
    isSupported: () => true,
    getAvailableVoices: () => [
      { name: 'Test Voice', lang: 'en-US' }
    ],
    updateSettings: vi.fn(),
    testSpeak: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock('../../services/QueueManager', () => ({
  QueueManager: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    skip: vi.fn(),
    isCurrentlyProcessing: () => false,
    destroy: vi.fn(),
    on: vi.fn(),
  })),
}));

const defaultSettings: TTSSettings = {
  enabled: true,
  volume: 0.8,
  rate: 1.0,
  pitch: 1.0,
  voice: null,
  filterBots: true,
  minMessageLength: 3,
  blockedUsers: [],
  skipEmoteOnly: true,
};

function renderFilterControls(initialSettings: Partial<TTSSettings> = {}) {
  const settings = { ...defaultSettings, ...initialSettings };
  
  return render(
    <TTSProvider initialSettings={settings}>
      <FilterControls />
    </TTSProvider>
  );
}

describe('FilterControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with all filter controls', () => {
      renderFilterControls();
      
      expect(screen.getByText('Message Filters')).toBeInTheDocument();
      expect(screen.getByText('Filter bot messages')).toBeInTheDocument();
      expect(screen.getByText('Skip emote-only messages')).toBeInTheDocument();
      expect(screen.getByText('Minimum message length')).toBeInTheDocument();
      expect(screen.getByText('Blocked users')).toBeInTheDocument();
      expect(screen.getByText('Active Filters')).toBeInTheDocument();
    });

    it('shows correct initial toggle states', () => {
      renderFilterControls({
        filterBots: true,
        skipEmoteOnly: false,
      });
      
      const botFilterToggle = screen.getByRole('checkbox', { name: /filter bot messages/i });
      const emoteFilterToggle = screen.getByRole('checkbox', { name: /skip emote-only messages/i });
      
      expect(botFilterToggle).toBeChecked();
      expect(emoteFilterToggle).not.toBeChecked();
    });

    it('displays current minimum message length', () => {
      renderFilterControls({ minMessageLength: 5 });
      
      const minLengthInput = screen.getByDisplayValue('5');
      expect(minLengthInput).toBeInTheDocument();
    });

    it('shows empty state when no blocked users', () => {
      renderFilterControls({ blockedUsers: [] });
      
      expect(screen.getByText('No blocked users')).toBeInTheDocument();
    });

    it('displays blocked users list when users are blocked', () => {
      renderFilterControls({ blockedUsers: ['user1', 'user2'] });
      
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
      expect(screen.queryByText('No blocked users')).not.toBeInTheDocument();
    });
  });

  describe('Bot Filter Toggle', () => {
    it('toggles bot filter when clicked', async () => {
      const user = userEvent.setup();
      renderFilterControls({ filterBots: false });
      
      const toggle = screen.getByRole('checkbox', { name: /filter bot messages/i });
      expect(toggle).not.toBeChecked();
      
      await user.click(toggle);
      
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });
  });

  describe('Emote Filter Toggle', () => {
    it('toggles emote filter when clicked', async () => {
      const user = userEvent.setup();
      renderFilterControls({ skipEmoteOnly: false });
      
      const toggle = screen.getByRole('checkbox', { name: /skip emote-only messages/i });
      expect(toggle).not.toBeChecked();
      
      await user.click(toggle);
      
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });
  });

  describe('Minimum Message Length', () => {
    it('updates minimum length when valid number is entered', async () => {
      const user = userEvent.setup();
      renderFilterControls({ minMessageLength: 3 });
      
      const input = screen.getByDisplayValue('3');
      
      await user.clear(input);
      await user.type(input, '10');
      
      expect(input).toHaveValue(10);
    });

    it('shows error for invalid input', async () => {
      const user = userEvent.setup();
      renderFilterControls({ minMessageLength: 3 });
      
      const input = screen.getByDisplayValue('3');
      
      await user.clear(input);
      await user.type(input, 'abc');
      
      expect(screen.getByText('Please enter a valid number')).toBeInTheDocument();
    });

    it('shows error for value less than 1', async () => {
      const user = userEvent.setup();
      renderFilterControls({ minMessageLength: 3 });
      
      const input = screen.getByDisplayValue('3');
      
      await user.clear(input);
      await user.type(input, '0');
      
      expect(screen.getByText('Minimum length must be at least 1')).toBeInTheDocument();
    });

    it('shows error for value greater than 500', async () => {
      const user = userEvent.setup();
      renderFilterControls({ minMessageLength: 3 });
      
      const input = screen.getByDisplayValue('3');
      
      await user.clear(input);
      await user.type(input, '501');
      
      expect(screen.getByText('Minimum length cannot exceed 500')).toBeInTheDocument();
    });

    it('reverts to valid value on blur when invalid', async () => {
      const user = userEvent.setup();
      renderFilterControls({ minMessageLength: 3 });
      
      const input = screen.getByDisplayValue('3');
      
      await user.clear(input);
      await user.type(input, 'abc');
      await user.tab(); // Trigger blur
      
      await waitFor(() => {
        expect(input).toHaveValue(3);
        expect(screen.queryByText('Please enter a valid number')).not.toBeInTheDocument();
      });
    });
  });

  describe('Blocked Users Management', () => {
    it('adds user to blocked list when Add button is clicked', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: [] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(input, 'testuser');
      await user.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(input).toHaveValue('');
      });
    });

    it('adds user when Enter key is pressed', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: [] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      
      await user.type(input, 'testuser');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(input).toHaveValue('');
      });
    });

    it('converts username to lowercase when adding', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: [] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(input, 'TestUser');
      await user.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('does not add empty or whitespace-only usernames', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: [] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(input, '   ');
      await user.click(addButton);
      
      expect(screen.getByText('No blocked users')).toBeInTheDocument();
    });

    it('does not add duplicate users', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: ['existinguser'] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(input, 'existinguser');
      await user.click(addButton);
      
      const userElements = screen.getAllByText('existinguser');
      expect(userElements).toHaveLength(1);
    });

    it('removes user from blocked list when remove button is clicked', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: ['user1', 'user2'] });
      
      const removeButtons = screen.getAllByTitle(/remove .* from blocked list/i);
      await user.click(removeButtons[0]);
      
      await waitFor(() => {
        expect(screen.queryByText('user1')).not.toBeInTheDocument();
        expect(screen.getByText('user2')).toBeInTheDocument();
      });
    });

    it('disables Add button when input is empty', () => {
      renderFilterControls({ blockedUsers: [] });
      
      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toBeDisabled();
    });

    it('enables Add button when input has content', async () => {
      const user = userEvent.setup();
      renderFilterControls({ blockedUsers: [] });
      
      const input = screen.getByPlaceholderText('Enter username to block');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      expect(addButton).toBeDisabled();
      
      await user.type(input, 'test');
      
      expect(addButton).toBeEnabled();
    });
  });

  describe('Filter Summary', () => {
    it('shows active filters in summary', () => {
      renderFilterControls({
        filterBots: true,
        skipEmoteOnly: true,
        minMessageLength: 5,
        blockedUsers: ['user1', 'user2'],
      });
      
      expect(screen.getByText('Bot messages filtered')).toBeInTheDocument();
      expect(screen.getByText('Emote-only messages filtered')).toBeInTheDocument();
      expect(screen.getByText('Messages under 5 characters filtered')).toBeInTheDocument();
      expect(screen.getByText('2 users blocked')).toBeInTheDocument();
    });

    it('shows correct singular/plural for blocked users count', () => {
      renderFilterControls({ blockedUsers: ['user1'] });
      
      expect(screen.getByText('1 user blocked')).toBeInTheDocument();
    });

    it('does not show inactive filters in summary', () => {
      renderFilterControls({
        filterBots: false,
        skipEmoteOnly: false,
        blockedUsers: [],
      });
      
      expect(screen.queryByText('Bot messages filtered')).not.toBeInTheDocument();
      expect(screen.queryByText('Emote-only messages filtered')).not.toBeInTheDocument();
      expect(screen.queryByText('users blocked')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for form controls', () => {
      renderFilterControls();
      
      expect(screen.getByLabelText('Filter bot messages')).toBeInTheDocument();
      expect(screen.getByLabelText('Skip emote-only messages')).toBeInTheDocument();
      expect(screen.getByLabelText('Minimum message length')).toBeInTheDocument();
      expect(screen.getByLabelText('Blocked users')).toBeInTheDocument();
    });

    it('has proper button titles for remove buttons', () => {
      renderFilterControls({ blockedUsers: ['testuser'] });
      
      expect(screen.getByTitle('Remove testuser from blocked list')).toBeInTheDocument();
    });
  });
});