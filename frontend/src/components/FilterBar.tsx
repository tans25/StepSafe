import React from 'react';
import { CATEGORY_INFO } from '../config';
import type { CategoryId } from '../types';
import { Layers, Clock } from 'lucide-react';

interface FilterBarProps {
  selectedCategory: CategoryId | 'all';
  onSelectCategory: (cat: CategoryId | 'all') => void;
  showStale: boolean;
  onToggleShowStale: () => void;
  reportCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  showStale,
  onToggleShowStale,
  reportCount,
}) => {
  return (
    <div className="filter-bar-container">
      <div className="filter-scroll-row">
        <button
          type="button"
          className={`filter-chip ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
          id="filter-all"
        >
          <Layers size={14} />
          <span>All ({reportCount})</span>
        </button>

        {Object.entries(CATEGORY_INFO).map(([id, info]) => {
          const isSelected = selectedCategory === id;
          return (
            <button
              key={id}
              type="button"
              className={`filter-chip ${isSelected ? 'active' : ''}`}
              style={
                isSelected
                  ? { borderColor: info.color, backgroundColor: info.badgeBg }
                  : undefined
              }
              onClick={() => onSelectCategory(id as CategoryId)}
              id={`filter-${id}`}
            >
              <span className="category-dot" style={{ backgroundColor: info.color }} />
              <span>{info.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`filter-chip stale-toggle ${showStale ? 'active' : ''}`}
          onClick={onToggleShowStale}
          title="Toggle visibility of reports older than 5 days"
          id="filter-stale-toggle"
        >
          <Clock size={14} />
          <span>{showStale ? 'Old Reports: Shown' : 'Old Reports: Hidden'}</span>
        </button>
      </div>
    </div>
  );
};
