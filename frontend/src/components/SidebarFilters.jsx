import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const SidebarFilters = ({ filters, onFilterChange, onReset }) => {
  const [categories, setCategories] = useState([]);
  
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/products/categories');
        setCategories(response.data);
      } catch (error) {
        console.error('Failed to load categories in sidebar:', error);
      }
    };
    fetchCategories();
  }, []);

  const handlePriceChange = (e) => {
    const { name, value } = e.target;
    onFilterChange(name, value);
  };

  return (
    <aside className="w-full lg:w-64 bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col space-y-6 shrink-0 h-fit">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 text-lg">Filters</h3>
        <button 
          onClick={onReset}
          className="text-sm font-semibold text-amazon-orange hover:underline focus:outline-none"
        >
          Clear All
        </button>
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-3">Category</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          <label className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 cursor-pointer">
            <input
              type="radio"
              name="category"
              value=""
              checked={!filters.category}
              onChange={() => onFilterChange('category', '')}
              className="text-amazon-orange focus:ring-amazon-yellow"
            />
            <span>All Categories</span>
          </label>
          {categories.map((cat) => (
            <label key={cat} className="flex items-center space-x-2 text-sm text-gray-700 capitalize hover:text-gray-900 cursor-pointer">
              <input
                type="radio"
                name="category"
                value={cat}
                checked={filters.category === cat}
                onChange={() => onFilterChange('category', cat)}
                className="text-amazon-orange focus:ring-amazon-yellow"
              />
              <span>{cat.replace('-', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Brand Search */}
      <div>
        <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-3">Brand</h4>
        <input
          type="text"
          placeholder="Filter by brand..."
          value={filters.brand || ''}
          onChange={(e) => onFilterChange('brand', e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazon-yellow focus:border-transparent"
        />
      </div>

      {/* Price Boundaries Filter */}
      <div>
        <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-3">Price Range</h4>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            name="minPrice"
            placeholder="Min ($)"
            value={filters.minPrice || ''}
            onChange={handlePriceChange}
            className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
            min="0"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="number"
            name="maxPrice"
            placeholder="Max ($)"
            value={filters.maxPrice || ''}
            onChange={handlePriceChange}
            className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
            min="0"
          />
        </div>
      </div>

    </aside>
  );
};

export default SidebarFilters;
