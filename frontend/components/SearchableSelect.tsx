import React, { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { ChevronDownIcon, XIcon, CheckIcon, LoaderIcon } from './Icons';

export interface SelectOption {
  id: string;
  name: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SelectOption[];
  selectedId: string | null;
  onChange: (value: string | null) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  onFetchOptions?: (searchTerm: string) => void;
  debounceMs?: number;
  allowCustomInput?: boolean;
  showStatusIndicator?: boolean;
  status?: 'idle' | 'loading' | 'success' | 'error';
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  selectedId,
  onChange,
  placeholder = 'Select or type to search...',
  disabled = false,
  className = '',
  loading = false,
  onFetchOptions,
  debounceMs = 300,
  allowCustomInput = false,
  showStatusIndicator = false,
  status = 'idle',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<SelectOption[]>(options);
  const comboBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when selection changes from outside
  useEffect(() => {
    if (selectedId) {
      const selectedOption = options.find(o => o.id === selectedId);
      if (selectedOption) {
        setInputValue(selectedOption.name);
      } else if (allowCustomInput) {
        setInputValue(selectedId);
      } else {
        setInputValue('');
      }
    } else {
      setInputValue('');
    }
  }, [selectedId, options, allowCustomInput]);

  // Filter options based on input value
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(options);
    } else {
      const searchLower = inputValue.trim().toLowerCase();
      const filtered = options.filter(option =>
        option.name.toLowerCase().includes(searchLower) ||
        option.id.toLowerCase().includes(searchLower)
      );
      setFilteredOptions(filtered);
    }
  }, [inputValue, options]);

  // Debounced fetch options
  useEffect(() => {
    if (!onFetchOptions) return;

    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        onFetchOptions(inputValue.trim());
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, onFetchOptions, debounceMs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboBoxRef.current && !comboBoxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleOptionSelect = useCallback(async (option: SelectOption) => {
    if (option.disabled) return;
    if (option.id === selectedId) {
      setIsOpen(false);
      return;
    }
    setInputValue(option.name);
    setIsOpen(false);
    await onChange(option.id);
  }, [selectedId, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && !filteredOptions[0].disabled) {
        handleOptionSelect(filteredOptions[0]);
      } else if (allowCustomInput && inputValue.trim()) {
        setInputValue(inputValue.trim());
        setIsOpen(false);
        onChange(inputValue.trim());
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      // Focus first option
      const firstOption = document.querySelector('[data-option-index="0"]') as HTMLElement;
      firstOption?.focus();
    }
  };

  const hasSelection = selectedId !== null;

  const handleClear = () => {
    setInputValue('');
    setIsOpen(false);
    onChange(null);
    inputRef.current?.focus();
  };

  const renderStatusIndicator = () => {
    if (!showStatusIndicator) return null;

    switch (status) {
      case 'loading':
        return (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <LoaderIcon className="w-4 h-4 text-yellow-400 animate-spin" />
          </div>
        );
      case 'success':
        return (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <CheckIcon className="w-4 h-4 text-green-400" />
          </div>
        );
      case 'error':
        return (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <XIcon className="w-4 h-4 text-red-400" />
          </div>
        );
      default:
        return null;
    }
  };

  const handleOptionKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextOption = document.querySelector(`[data-option-index="${index + 1}"]`) as HTMLElement;
      nextOption?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 0) {
        inputRef.current?.focus();
      } else {
        const prevOption = document.querySelector(`[data-option-index="${index - 1}"]`) as HTMLElement;
        prevOption?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filteredOptions[index];
      if (option && !option.disabled) {
        handleOptionSelect(option);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={comboBoxRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-3 py-1.5 rounded-md text-white placeholder-gray-400 focus:ring-2 disabled:bg-gray-800 disabled:cursor-not-allowed text-sm ${hasSelection
            ? 'bg-blue-800 border-2 border-blue-400 focus:border-blue-400 focus:ring-blue-400 pr-16'
            : 'bg-gray-700 border-2 border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 pr-10'
            }`}
        />
        {renderStatusIndicator()}
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5">
          {hasSelection && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-0.5 text-gray-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-1 text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isOpen ? 'Close dropdown' : 'Open dropdown'}
            tabIndex={-1}
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
              <LoaderIcon className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.id}
                data-option-index={index}
                tabIndex={0}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                onClick={() => !option.disabled && handleOptionSelect(option)}
                className={`px-3 py-2 hover:bg-gray-600 transition-colors cursor-pointer ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {option.id === selectedId && (
                    <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{option.name}</div>
                    <div className="text-xs text-gray-400 truncate">{option.id}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-400">
              {allowCustomInput ? 'Press Enter to use custom value' : 'No options found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
