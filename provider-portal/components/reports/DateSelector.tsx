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

const QUICK_SELECTS = [
  {
    id: 'yesterday',
    label: 'Yesterday',
    getDates: (): DateRange => {
      const yesterday = subDays(new Date(), 1);
      return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday), label: 'Yesterday' };
    },
  },
  {
    id: 'last7',
    label: '7d',
    getDates: (): DateRange => ({
      startDate: startOfDay(subDays(new Date(), 7)),
      endDate: endOfDay(new Date()),
      label: 'Last 7 Days',
    }),
  },
  {
    id: 'last15',
    label: '15d',
    getDates: (): DateRange => ({
      startDate: startOfDay(subDays(new Date(), 15)),
      endDate: endOfDay(new Date()),
      label: 'Last 15 Days',
    }),
  },
  {
    id: 'last30',
    label: '30d',
    getDates: (): DateRange => ({
      startDate: startOfDay(subDays(new Date(), 30)),
      endDate: endOfDay(new Date()),
      label: 'Last 30 Days',
    }),
  },
  {
    id: '3months',
    label: '3m',
    getDates: (): DateRange => ({
      startDate: startOfDay(subMonths(new Date(), 3)),
      endDate: endOfDay(new Date()),
      label: 'Last 3 Months',
    }),
  },
  {
    id: '6months',
    label: '6m',
    getDates: (): DateRange => ({
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      label: 'Last 6 Months',
    }),
  },
  {
    id: 'year',
    label: '1y',
    getDates: (): DateRange => ({
      startDate: startOfDay(subYears(new Date(), 1)),
      endDate: endOfDay(new Date()),
      label: 'Last Year',
    }),
  },
];

export default function DateSelector({ onDateRangeChange, initialDateRange }: DateSelectorProps) {
  const [selectedRange, setSelectedRange] = useState<DateRange>(
    initialDateRange || QUICK_SELECTS[0].getDates()
  );
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const handleQuickSelect = (qs: (typeof QUICK_SELECTS)[number]) => {
    const dateRange = qs.getDates();
    setSelectedRange(dateRange);
    setShowCustomPicker(false);
    onDateRangeChange(dateRange);
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      const dateRange: DateRange = {
        startDate: startOfDay(customStartDate),
        endDate: endOfDay(customEndDate),
        label: `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d, yyyy')}`,
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
      label: `${format(newStartDate, 'MMM d')} - ${format(newEndDate, 'MMM d, yyyy')}`,
    };
    setSelectedRange(dateRange);
    onDateRangeChange(dateRange);
  };

  const handleNextPeriod = () => {
    const today = new Date();
    if (selectedRange.endDate >= endOfDay(today)) return;
    const daysDiff = Math.ceil(
      (selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newStartDate = startOfDay(subDays(selectedRange.endDate, -1));
    let newEndDate = endOfDay(subDays(newStartDate, -(daysDiff - 1)));
    if (newEndDate > endOfDay(today)) newEndDate = endOfDay(today);
    const dateRange: DateRange = {
      startDate: newStartDate,
      endDate: newEndDate,
      label: `${format(newStartDate, 'MMM d')} - ${format(newEndDate, 'MMM d, yyyy')}`,
    };
    setSelectedRange(dateRange);
    onDateRangeChange(dateRange);
  };

  const isNextDisabled = selectedRange.endDate >= endOfDay(new Date());

  const isActive = (qs: (typeof QUICK_SELECTS)[number]) => selectedRange.label === qs.getDates().label;

  return (
    <div className="space-y-3">
      {/* Row 1: Quick-select pills */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_SELECTS.map((qs) => (
          <button
            key={qs.id}
            onClick={() => handleQuickSelect(qs)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isActive(qs)
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-input text-foreground/70 hover:bg-muted/50'
            }`}
          >
            {qs.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            showCustomPicker
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-input text-foreground/70 hover:bg-muted/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Custom
        </button>
      </div>

      {/* Custom Date Picker */}
      {showCustomPicker && (
        <div className="rounded-xl border border-border/60 bg-card shadow-lg p-5 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">Start Date</label>
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
              <label className="block text-sm font-medium text-foreground/80 mb-2">End Date</label>
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
              className="px-3 py-1.5 text-sm font-medium text-foreground bg-card border border-input rounded-lg hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomDateApply}
              disabled={!customStartDate || !customEndDate}
              className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Period navigation */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handlePrevPeriod}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          title="Previous period"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <span className="text-sm font-medium text-foreground">
            {selectedRange.label === 'Yesterday'
              ? format(selectedRange.startDate, 'EEEE, MMMM d, yyyy')
              : selectedRange.label}
          </span>
          {selectedRange.label !== 'Yesterday' && (
            <span className="text-xs text-muted-foreground ml-2">
              {format(selectedRange.startDate, 'MMM d')} – {format(selectedRange.endDate, 'MMM d, yyyy')}
            </span>
          )}
        </div>

        <button
          onClick={handleNextPeriod}
          disabled={isNextDisabled}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next period"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
