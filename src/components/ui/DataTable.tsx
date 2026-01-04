'use client';

import { ReactNode, useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
  sortable?: boolean;
  sortKey?: string; // Use different key for sorting than display
  sortFn?: (a: T, b: T) => number; // Custom sort function
}

type SortDirection = 'asc' | 'desc' | null;

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
  defaultSort?: { key: string; direction: SortDirection };
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  className = '',
  defaultSort,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction || null);

  // Handle undefined or null data
  const safeData = data || [];

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return safeData;

    const column = columns.find((c) => c.key === sortKey || c.sortKey === sortKey);
    if (!column) return safeData;

    return [...safeData].sort((a, b) => {
      // Use custom sort function if provided
      if (column.sortFn) {
        const result = column.sortFn(a, b);
        return sortDirection === 'desc' ? -result : result;
      }

      // Get values using sortKey or key
      const keyToUse = column.sortKey || column.key;
      const aVal = getNestedValue(a, keyToUse);
      const bVal = getNestedValue(b, keyToUse);

      // Handle nullish values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // Compare values
      let result = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        result = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        result = aVal.localeCompare(bVal);
      } else {
        result = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'desc' ? -result : result;
    });
  }, [safeData, sortKey, sortDirection, columns]);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    const key = column.sortKey || column.key;

    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  if (safeData.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className={`data-table ${className}`}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isActive = sortKey === (col.sortKey || col.key);
              return (
                <th
                  key={col.key}
                  className={`${col.align === 'left' ? 'text-left' : ''} ${
                    col.sortable ? 'sortable-header' : ''
                  } ${isActive ? 'sorted' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleSort(col)}
                >
                  <span className="header-content">
                    {col.header}
                    {col.sortable && (
                      <span className="sort-indicator">
                        {isActive && sortDirection === 'asc' && '▲'}
                        {isActive && sortDirection === 'desc' && '▼'}
                        {!isActive && '⇅'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr key={keyExtractor(row, rowIndex)}>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'left'
                    ? 'text-left'
                    : col.align === 'right'
                    ? 'text-right'
                    : '';
                return (
                  <td
                    key={col.key}
                    className={`${alignClass} ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(row, rowIndex)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper components for common table cell patterns
export function RecordCell({
  wins,
  losses,
  winPct,
  rank,
}: {
  wins: number;
  losses: number;
  winPct?: number;
  rank?: number;
}) {
  return (
    <span className="col-numeric">
      {wins}-{losses}
      {winPct !== undefined && (
        <span className="text-muted text-xs ml-1">({winPct}%)</span>
      )}
      {rank !== undefined && (
        <span className="text-muted text-xs ml-1">[{rank}]</span>
      )}
    </span>
  );
}

export function PointsCell({
  value,
  rank,
}: {
  value: number;
  rank?: number;
}) {
  const displayValue = typeof value === 'number' ? value.toFixed(2) : '—';
  return (
    <span className="col-numeric">
      {displayValue}
      {rank !== undefined && (
        <span className="text-muted text-xs ml-1">({rank})</span>
      )}
    </span>
  );
}

export function WinLossCell({ isWin }: { isWin: boolean }) {
  return (
    <span className={isWin ? 'text-win font-semibold' : 'text-loss font-semibold'}>
      {isWin ? 'W' : 'L'}
    </span>
  );
}

export function StreakCell({
  type,
  length,
}: {
  type: 'W' | 'L' | null;
  length: number;
}) {
  if (!type || length === 0) {
    return <span className="text-muted">—</span>;
  }
  return (
    <span className={type === 'W' ? 'text-win font-bold' : 'text-loss font-bold'}>
      {length}{type}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  return <span className="rank-badge">{rank}</span>;
}
