import React, { useState, useCallback } from 'react';
import './TabContainer.css';

/**
 * Tab item interface
 */
export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
  badge?: string | number;
}

/**
 * Props for the TabContainer component
 */
interface TabContainerProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * TabContainer component that provides a tabbed interface
 * Requirements: 5.1, 5.4 - Responsive tabbed interface with consistent design
 */
export function TabContainer({ 
  tabs, 
  defaultActiveTab, 
  className = '',
  onTabChange 
}: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.id || '');

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  }, [onTabChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, tabId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabClick(tabId);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      const nextIndex = event.key === 'ArrowLeft' 
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length;
      handleTabClick(tabs[nextIndex].id);
    }
  }, [activeTab, tabs, handleTabClick]);



  return (
    <div className={`tab-container ${className}`}>
      {/* Tab Navigation */}
      <div 
        className="tab-container__nav" 
        role="tablist" 
        aria-label="Main navigation tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-container__tab ${activeTab === tab.id ? 'tab-container__tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
          >
            {tab.icon && (
              <span className="tab-container__tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span className="tab-container__tab-label">
              {tab.label}
            </span>
            {tab.badge && (
              <span className="tab-container__tab-badge" aria-label={`${tab.badge} items`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-container__content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-container__panel ${activeTab === tab.id ? 'tab-container__panel--active' : ''}`}
            role="tabpanel"
            id={`tabpanel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={activeTab !== tab.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabContainer;