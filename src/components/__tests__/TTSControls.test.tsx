
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TTSControls } from '../TTSControls';

// Mock the TTS context hooks directly
const mockUseTTSControls = vi.fn();
const mockUseTTSQueue = vi.fn();

vi.mock('../../contexts/TTSContext', () => ({
  useTTSControls: () => mockUseTTSControls(),
  useTTSQueue: () => mockUseTTSQueue()
}));

// Default mock values
const defaultTTSControls = {
  settings: {
    enabled: false,
    volume: 0.8,
    rate: 1.0,
    pitch: 1.0,
    voice: null,
    filterBots: true,
    minMessageLength: 3,
    blockedUsers: [],
    skipEmoteOnly: true,
  },
  updateSettings: vi.fn(),
  testSpeak: vi.fn().mockResolvedValue(undefined),
  availableVoices: [
    { name: 'Test Voice 1', lang: 'en-US' },
    { name: 'Test Voice 2', lang: 'en-GB' }
  ],
  isSupported: true,
  error: null
};

const defaultTTSQueue = {
  actions: {
    clearQueue: vi.fn()
  }
};

describe('TTSControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTTSControls.mockReturnValue(defaultTTSControls);
    mockUseTTSQueue.mockReturnValue(defaultTTSQueue);
  });

  it('renders TTS controls with all elements', () => {
    render(<TTSControls />);

    // Check for main elements
    expect(screen.getByText('TTS Controls')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByLabelText(/Voice/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Volume/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Speed/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pitch/)).toBeInTheDocument();
    expect(screen.getByText('Test Voice')).toBeInTheDocument();
    expect(screen.getByText('Clear Queue')).toBeInTheDocument();
  });

  it('shows disabled state when TTS is not supported', () => {
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      isSupported: false
    });
    
    render(<TTSControls />);

    expect(screen.getByText('Text-to-speech is not supported in this browser')).toBeInTheDocument();
  });

  it('toggles TTS enabled state', () => {
    const updateSettings = vi.fn();
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      updateSettings
    });

    render(<TTSControls />);

    const toggleCheckbox = screen.getByRole('checkbox');
    
    // Initially disabled
    expect(toggleCheckbox).not.toBeChecked();
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    // Click to enable
    fireEvent.click(toggleCheckbox);
    
    expect(updateSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('updates volume setting when slider changes', () => {
    const updateSettings = vi.fn();
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      updateSettings
    });

    render(<TTSControls />);

    const volumeSlider = screen.getByLabelText(/Volume/) as HTMLInputElement;
    
    // Change volume to 50%
    fireEvent.change(volumeSlider, { target: { value: '0.5' } });
    
    expect(updateSettings).toHaveBeenCalledWith({ volume: 0.5 });
  });

  it('updates rate setting when slider changes', () => {
    const updateSettings = vi.fn();
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      updateSettings
    });

    render(<TTSControls />);

    const rateSlider = screen.getByLabelText(/Speed/) as HTMLInputElement;
    
    // Change rate to 1.5x
    fireEvent.change(rateSlider, { target: { value: '1.5' } });
    
    expect(updateSettings).toHaveBeenCalledWith({ rate: 1.5 });
  });

  it('updates pitch setting when slider changes', () => {
    const updateSettings = vi.fn();
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      updateSettings
    });

    render(<TTSControls />);

    const pitchSlider = screen.getByLabelText(/Pitch/) as HTMLInputElement;
    
    // Change pitch to 1.2
    fireEvent.change(pitchSlider, { target: { value: '1.2' } });
    
    expect(updateSettings).toHaveBeenCalledWith({ pitch: 1.2 });
  });

  it('changes voice selection', () => {
    const updateSettings = vi.fn();
    const availableVoices = [
      { name: 'Test Voice 1', lang: 'en-US' },
      { name: 'Test Voice 2', lang: 'en-GB' }
    ];
    
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      updateSettings,
      availableVoices
    });

    render(<TTSControls />);

    const voiceSelect = screen.getByLabelText(/Voice/) as HTMLSelectElement;
    
    // Change to second voice
    fireEvent.change(voiceSelect, { target: { value: '1' } });
    
    expect(updateSettings).toHaveBeenCalledWith({ voice: availableVoices[1] });
  });

  it('handles test speak functionality', async () => {
    const testSpeak = vi.fn().mockResolvedValue(undefined);
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      settings: { ...defaultTTSControls.settings, enabled: true },
      testSpeak
    });

    render(<TTSControls />);

    const testButton = screen.getByText('Test Voice');
    
    // Click test button
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(testSpeak).toHaveBeenCalledWith('This is a test of the text to speech system.');
    });
  });

  it('shows clear queue confirmation', () => {
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      settings: { ...defaultTTSControls.settings, enabled: true }
    });

    render(<TTSControls />);

    const clearButton = screen.getByText('Clear Queue');
    
    // Click clear button
    fireEvent.click(clearButton);
    
    expect(screen.getByText('Clear queue?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('confirms queue clearing', () => {
    const clearQueue = vi.fn();
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      settings: { ...defaultTTSControls.settings, enabled: true }
    });
    mockUseTTSQueue.mockReturnValue({
      actions: { clearQueue }
    });

    render(<TTSControls />);

    // Show confirmation
    const clearButton = screen.getByText('Clear Queue');
    fireEvent.click(clearButton);

    // Confirm clearing
    const confirmButton = screen.getByText('Yes');
    fireEvent.click(confirmButton);
    
    expect(clearQueue).toHaveBeenCalled();
  });

  it('cancels queue clearing', () => {
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      settings: { ...defaultTTSControls.settings, enabled: true }
    });

    render(<TTSControls />);

    // Show confirmation
    const clearButton = screen.getByText('Clear Queue');
    fireEvent.click(clearButton);

    // Cancel clearing
    const cancelButton = screen.getByText('No');
    fireEvent.click(cancelButton);
    
    expect(screen.getByText('Clear Queue')).toBeInTheDocument();
    expect(screen.queryByText('Clear queue?')).not.toBeInTheDocument();
  });

  it('disables controls when TTS is disabled', () => {
    render(<TTSControls />);

    // Controls should be disabled initially (TTS is disabled by default)
    expect(screen.getByLabelText(/Voice/)).toBeDisabled();
    expect(screen.getByLabelText(/Volume/)).toBeDisabled();
    expect(screen.getByLabelText(/Speed/)).toBeDisabled();
    expect(screen.getByLabelText(/Pitch/)).toBeDisabled();
    expect(screen.getByText('Test Voice')).toBeDisabled();
    expect(screen.getByText('Clear Queue')).toBeDisabled();
  });

  it('enables controls when TTS is enabled', () => {
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      settings: { ...defaultTTSControls.settings, enabled: true }
    });

    render(<TTSControls />);

    expect(screen.getByLabelText(/Voice/)).not.toBeDisabled();
    expect(screen.getByLabelText(/Volume/)).not.toBeDisabled();
    expect(screen.getByLabelText(/Speed/)).not.toBeDisabled();
    expect(screen.getByLabelText(/Pitch/)).not.toBeDisabled();
    expect(screen.getByText('Test Voice')).not.toBeDisabled();
    expect(screen.getByText('Clear Queue')).not.toBeDisabled();
  });

  it('displays error messages', () => {
    mockUseTTSControls.mockReturnValue({
      ...defaultTTSControls,
      error: 'Test error message'
    });

    render(<TTSControls />);

    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});