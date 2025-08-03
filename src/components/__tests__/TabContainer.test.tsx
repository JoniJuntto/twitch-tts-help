import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TabContainer, TabItem } from '../TabContainer';

describe('TabContainer', () => {
  const mockTabs: TabItem[] = [
    {
      id: 'tab1',
      label: 'Tab 1',
      icon: '📝',
      content: <div>Content 1</div>,
      badge: '5'
    },
    {
      id: 'tab2',
      label: 'Tab 2',
      icon: '🔧',
      content: <div>Content 2</div>
    },
    {
      id: 'tab3',
      label: 'Tab 3',
      content: <div>Content 3</div>,
      badge: 10
    }
  ];

  it('renders all tabs', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('renders tab icons', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('renders tab badges', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows first tab as active by default', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const firstTab = screen.getByRole('tab', { name: /tab 1/i });
    expect(firstTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('shows specified default active tab', () => {
    render(<TabContainer tabs={mockTabs} defaultActiveTab="tab2" />);
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('switches tabs when clicked', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    fireEvent.click(secondTab);
    
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('calls onTabChange when tab is switched', () => {
    const onTabChange = vi.fn();
    render(<TabContainer tabs={mockTabs} onTabChange={onTabChange} />);
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    fireEvent.click(secondTab);
    
    expect(onTabChange).toHaveBeenCalledWith('tab2');
  });

  it('handles keyboard navigation with Enter key', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    fireEvent.keyDown(secondTab, { key: 'Enter' });
    
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('handles keyboard navigation with Space key', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    fireEvent.keyDown(secondTab, { key: ' ' });
    
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('handles keyboard navigation with arrow keys', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const firstTab = screen.getByRole('tab', { name: /tab 1/i });
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('wraps around when navigating with arrow keys', () => {
    render(<TabContainer tabs={mockTabs} defaultActiveTab="tab3" />);
    
    const thirdTab = screen.getByRole('tab', { name: /tab 3/i });
    fireEvent.keyDown(thirdTab, { key: 'ArrowRight' });
    
    const firstTab = screen.getByRole('tab', { name: /tab 1/i });
    expect(firstTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TabContainer tabs={mockTabs} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('tab-container', 'custom-class');
  });

  it('has proper ARIA attributes', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label', 'Main navigation tabs');
    
    const firstTab = screen.getByRole('tab', { name: /tab 1/i });
    expect(firstTab).toHaveAttribute('aria-controls', 'tabpanel-tab1');
    expect(firstTab).toHaveAttribute('id', 'tab-tab1');
    
    const firstPanel = screen.getByRole('tabpanel', { hidden: false });
    expect(firstPanel).toHaveAttribute('aria-labelledby', 'tab-tab1');
    expect(firstPanel).toHaveAttribute('id', 'tabpanel-tab1');
  });

  it('manages tabindex correctly', () => {
    render(<TabContainer tabs={mockTabs} />);
    
    const firstTab = screen.getByRole('tab', { name: /tab 1/i });
    const secondTab = screen.getByRole('tab', { name: /tab 2/i });
    const thirdTab = screen.getByRole('tab', { name: /tab 3/i });
    
    expect(firstTab).toHaveAttribute('tabindex', '0');
    expect(secondTab).toHaveAttribute('tabindex', '-1');
    expect(thirdTab).toHaveAttribute('tabindex', '-1');
  });

  it('hides inactive tab panels', () => {
    const { container } = render(<TabContainer tabs={mockTabs} />);
    
    // Find all tab panels by their class or data attribute
    const allPanels = container.querySelectorAll('[role="tabpanel"]');
    expect(allPanels).toHaveLength(3);
    
    // Check that only one panel is visible (not hidden)
    const visiblePanels = Array.from(allPanels).filter(panel => !panel.hasAttribute('hidden'));
    expect(visiblePanels).toHaveLength(1);
    
    // Check that two panels are hidden
    const hiddenPanels = Array.from(allPanels).filter(panel => panel.hasAttribute('hidden'));
    expect(hiddenPanels).toHaveLength(2);
    
    // Verify the active panel shows the correct content
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('handles empty tabs array gracefully', () => {
    render(<TabContainer tabs={[]} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(tablist.children).toHaveLength(0);
  });
});