'use client';

import { ReactNode, CSSProperties } from 'react';

interface TabItem {
  key: string;
  label: string;
  deemphasized?: boolean;
}

interface NavigationTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function NavigationTabs({ tabs, activeTab, onTabChange }: NavigationTabsProps) {
  return (
    <nav className="nav-primary" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`nav-tab ${activeTab === tab.key ? 'active' : ''} ${
            tab.deemphasized ? 'de-emphasized' : ''
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

interface ControlFieldProps {
  label: string;
  children: ReactNode;
}

export function ControlField({ label, children }: ControlFieldProps) {
  return (
    <div className="control-field">
      <label className="control-label">{label}</label>
      {children}
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ value, onChange, options, className = '' }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`control-select ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} ${className}`}
    >
      {children}
    </button>
  );
}

interface InfoBannerProps {
  children: ReactNode;
  variant?: 'info' | 'warning' | 'error';
  style?: CSSProperties;
}

export function InfoBanner({ children, variant = 'info', style }: InfoBannerProps) {
  return (
    <div className={`info-banner ${variant !== 'info' ? variant : ''}`} style={style}>
      {children}
    </div>
  );
}

export function LoadingIndicator({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-indicator">
      <div className="loading-spinner" />
      <span>{message}</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      {description && <p>{description}</p>}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </header>
  );
}

interface SectionHeaderProps {
  title: string;
  context?: string;
}

export function SectionHeader({ title, context }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <h2 className="section-title">{title}</h2>
      {context && <p className="section-context">{context}</p>}
    </header>
  );
}

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: string | number;
  isChampion?: boolean;
}

export function SummaryStat({ label, value, isChampion }: SummaryStatProps) {
  return (
    <div className="summary-stat">
      <div className="summary-label">{label}</div>
      <div className={`summary-value ${isChampion ? 'champion' : ''}`}>{value}</div>
    </div>
  );
}

interface SummaryRowProps {
  children: ReactNode;
}

export function SummaryRow({ children }: SummaryRowProps) {
  return <div className="summary-row">{children}</div>;
}
