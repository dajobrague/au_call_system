/**
 * Date Selector Component for Reports
 * Allows quick selection of date ranges or custom date picking
 */

'use client';

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateSelectorProps {
  onDateRangeChange: (dateRange: DateRange) => void;
  initialDateRange?: DateRange;
}

export default function DateSelector({ onDateRangeChange, initialDateRange }: DateSelectorProps) {
  const [selectedRange, setSelectedRange] = useState<DateRange>(
    initialDateRange || getYesterday()
  );
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  
  // Quick select options
  const quickSelects = [
    {
      id: 'yesterday',
      label: 'Yesterday',
      getDates: () => getYesterday()
    },
    {
      id: 'last7',
      label: 'Last 7 Days',
      getDates: () => ({
        startDate: startOfDay(subDays(new Date(), 7)),
        endDate: endOfDay(new Date()),
        label: 'Last 7 Days'
      })
    },
    {
      id: 'last15',
      label: 'Last 15 Days',
      getDates: () => ({
        startDate: startOfDay(subDays(new Date(), 15)),
        endDate: endOfDay(new Date()),
        label: 'Last 15 Days'
      })
    },
    {
      id: 'last30',
      label: 'Last 30 Days',
      getDates: () => ({
        startDate: startOfDay(subDays(new Date(), 30)),
        endDate: endOfDay(new Date()),
        label: 'Last 30 Days'
      })
    },
    {
      id: '3months',
      label: '3 Months',
      getDates: () => ({
        startDate: startOfDay(subMonths(new Date(), 3)),
        endDate: endOfDay(new Date()),
        label: 'Last 3 Months'
      })
    },
    {
      id: '6months',
      label: '6 Months',
      getDates: () => ({
        startDate: startOfDay(subMonths(new Date(), 6)),
        endDate: endOfDay(new Date()),
        label: 'Last 6 Months'
      })
    },
    {
      id: 'year',
      label: 'Year',
      getDates: () => ({
        startDate: startOfDay(subYears(new Date(), 1)),
        endDate: endOfDay(new Date()),
        label: 'Last Year'
      })
    }
  ];
  
  function getYesterday(): DateRange {
    const yesterday = subDays(new Date(), 1);
    return {
      startDate: startOfDay(yesterday),
      endDate: endOfDay(yesterday),
      label: 'Yesterday'
    };
  }
  
  const handleQuickSelect = (quickSelect: typeof quickSelects[0]) => {
    const dateRange = quickSelect.getDates();
    setSelectedRange(dateRange);
    setShowCustomPicker(false);
    onDateRangeChange(dateRange);
  };
  
  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      const dateRange: DateRange = {
        startDate: startOfDay(customStartDate),
        endDate: endOfDay(customEndDate),
        label: `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d, yyyy')}`
      };
      setSelectedRange(dateRange);
      setShowCustomPicker(false);
      onDateRangeChange(dateRange);
    }
  };
  
  const handlePrevPeriod = () => {
    const daysDiff = Math.ceil(
      (selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newEndDate = startOfDay(subDays(selectedRange.startDate, 1));
    const newStartDate = startOfDay(subDays(newEndDate, daysDiff - 1));
    
    const dateRange: DateRange = {
      startDate: newStartDate,
      endDate: endOfDay(newEndDate),
      label: `${format(newStartDate, 'MMM d')} - ${format(newEndDate, 'MMM d, yyyy')}`
    };
    setSelectedRange(dateRange);
    onDateRangeChange(dateRange);
  };
  
  const handleNextPeriod = () => {
    const today = new Date();
    if (selectedRange.endDate >= endOfDay(today)) return; // Can't go beyond today
    
    const daysDiff = Math.ceil(
      (selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newStartDate = startOfDay(subDays(selectedRange.endDate, -1));
    const newEndDate = endOfDay(subDays(newStartDate, -(daysDiff - 1)));
    
    // Don't go beyond today
    const finalEndDate = newEndDate > endOfDay(today) ? endOfDay(today) : newEndDate;
    
    const dateRange: DateRange = {
      startDate: newStartDate,
      endDate: finalEndDate,
      label: `${format(newStartDate, 'MMM d')} - ${format(finalEndDate, 'MMM d, yyyy')}`
    };
    setSelectedRange(dateRange);
    onDateRangeChange(dateRange);
  };
  
  const isNextDisabled = selectedRange.endDate >= endOfDay(new Date());
  
  return (
    <div className="space-y-4">
      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2">
        {quickSelects.map((quickSelect) => (
          <button
            key={quickSelect.id}
            onClick={() => handleQuickSelect(quickSelect)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedRange.label === quickSelect.label
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground/80 border border-input hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {quickSelect.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            showCustomPicker
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground/80 border border-input hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Custom Range
        </button>
      </div>
      
      {/* Custom Date Picker */}
      {showCustomPicker && (
        <div className="bg-card border border-border/60 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Start Date
              </label>
              <DatePicker
                selected={customStartDate}
                onChange={(date) => setCustomStartDate(date)}
                selectsStart
                startDate={customStartDate}
                endDate={customEndDate}
                maxDate={new Date()}
                className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                dateFormat="MMM d, yyyy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                End Date
              </label>
              <DatePicker
                selected={customEndDate}
                onChange={(date) => setCustomEndDate(date)}
                selectsEnd
                startDate={customStartDate}
                endDate={customEndDate}
                minDate={customStartDate || undefined}
                maxDate={new Date()}
                className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                dateFormat="MMM d, yyyy"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCustomPicker(false)}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-lg hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomDateApply}
              disabled={!customStartDate || !customEndDate}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
      
      {/* Selected Period Display with Navigation */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl p-4">
        <button
          onClick={handlePrevPeriod}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          title="Previous period"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <div className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-1">Selected period</div>
          <div className="text-lg font-semibold text-foreground">
            {selectedRange.label === 'Yesterday' 
              ? `${format(selectedRange.startDate, 'EEEE, MMMM d, yyyy')}`
              : selectedRange.label
            }
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {format(selectedRange.startDate, 'MMM d, yyyy')} - {format(selectedRange.endDate, 'MMM d, yyyy')}
          </div>
        </div>
        
        <button
          onClick={handleNextPeriod}
          disabled={isNextDisabled}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next period"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
