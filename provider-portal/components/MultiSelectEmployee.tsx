/**
 * Multi-Select Employee Component
 * Allows searching and selecting multiple employees with a nice UX
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
}

interface MultiSelectEmployeeProps {
  employees: Employee[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function MultiSelectEmployee({
  employees,
  selectedIds,
  onChange,
  placeholder = 'Search and select employees...',
  label = 'Related Staff Pool'
}: MultiSelectEmployeeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update dropdown position
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  // Get selected employees
  const selectedEmployees = employees.filter(emp => selectedIds.includes(emp.id));

  // Filter available employees (not already selected)
  const availableEmployees = employees.filter(emp => {
    const isNotSelected = !selectedIds.includes(emp.id);
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    return isNotSelected && matchesSearch;
  });

  const handleSelect = (employeeId: string) => {
    onChange([...selectedIds, employeeId]);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleRemove = (employeeId: string) => {
    onChange(selectedIds.filter(id => id !== employeeId));
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    updatePosition();
  };

  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
      setSearchTerm('');
    } else {
      setIsOpen(true);
      updatePosition();
      inputRef.current?.focus();
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          {label}
        </label>
      )}
      
      {/* Selected Employees (Tags) */}
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedEmployees.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
            >
              <span>{employee.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(employee.id)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 border border-input rounded-md focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary bg-card">
          <Search className="w-4 h-4 text-muted-foreground/60" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) {
                setIsOpen(true);
                updatePosition();
              }
            }}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="flex-1 outline-none text-foreground text-sm"
          />
          <button
            type="button"
            onClick={toggleDropdown}
            className="hover:bg-muted/50 rounded p-1 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="fixed z-9999 bg-card border border-input rounded-md shadow-lg max-h-60 overflow-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`
            }}
          >
            {availableEmployees.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                {searchTerm ? 'No employees found' : 'All employees selected'}
              </div>
            ) : (
              availableEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => handleSelect(employee.id)}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/30 transition-colors"
                >
                  {employee.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className="mt-1 text-xs text-muted-foreground">
        {selectedEmployees.length === 0 
          ? 'Click to search and select employees' 
          : `${selectedEmployees.length} employee${selectedEmployees.length !== 1 ? 's' : ''} selected`}
      </p>
    </div>
  );
}

