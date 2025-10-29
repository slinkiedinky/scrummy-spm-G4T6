"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Repeat, Info } from "lucide-react";
import { format } from "date-fns";

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const END_CONDITIONS = [
  { value: "never", label: "Never" },
  { value: "after_count", label: "After number of times" },
  { value: "on_date", label: "On specific date" },
];

export function RecurringTaskForm({ 
  value, 
  onChange, 
  disabled = false,
  currentDueDate = null
}) {
  const [isRecurring, setIsRecurring] = useState(value?.isRecurring || false);
  const [frequency, setFrequency] = useState(value?.recurrencePattern?.frequency || "daily");
  const [interval, setInterval] = useState(value?.recurrencePattern?.interval || 1);
  const [endCondition, setEndCondition] = useState(value?.recurrencePattern?.endCondition || "never");
  const [maxCount, setMaxCount] = useState(value?.recurrencePattern?.maxCount || 5);
  const [endDate, setEndDate] = useState(
    value?.recurrencePattern?.endDate ? new Date(value.recurrencePattern.endDate) : null
  );

  // Update parent whenever values change
  useEffect(() => {
    if (!isRecurring) {
      onChange({ isRecurring: false, recurrencePattern: null });
      return;
    }

    const pattern = {
      frequency,
      interval,
      endCondition,
      ...(endCondition === "after_count" && { maxCount }),
      ...(endCondition === "on_date" && endDate && { endDate: endDate.toISOString() }),
    };

    onChange({
      isRecurring: true,
      recurrencePattern: pattern,
    });
  }, [isRecurring, frequency, interval, endCondition, maxCount, endDate, onChange]);

  const getRecurrenceSummary = () => {
    if (!isRecurring) return null;

    let summary = `Repeats every ${interval > 1 ? interval + " " : ""}${frequency}`;

    if (endCondition === "after_count") {
      summary += ` • ${maxCount} times`;
    } else if (endCondition === "on_date" && endDate) {
      summary += ` • Until ${format(endDate, "MMM d, yyyy")}`;
    } else {
      summary += ` • Forever`;
    }

    return summary;
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-purple-50/50">
      {/* Recurring Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-purple-600" />
          <Label htmlFor="recurring-toggle" className="font-medium cursor-pointer">
            Make this a recurring task
          </Label>
        </div>
        <Switch
          id="recurring-toggle"
          checked={isRecurring}
          onCheckedChange={setIsRecurring}
          disabled={disabled}
        />
      </div>

      {isRecurring && (
        <>
          {/* Frequency and Interval */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Repeat</Label>
              <Select value={frequency} onValueChange={setFrequency} disabled={disabled}>
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Every</Label>
              <Input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1 bg-white"
                disabled={disabled}
              />
            </div>
          </div>

          {/* End Condition */}
          <div>
            <Label className="text-sm">Ends</Label>
            <Select value={endCondition} onValueChange={setEndCondition} disabled={disabled}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {END_CONDITIONS.map((cond) => (
                  <SelectItem key={cond.value} value={cond.value}>
                    {cond.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max Count (if after_count) */}
          {endCondition === "after_count" && (
            <div>
              <Label className="text-sm">Number of occurrences</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={maxCount}
                onChange={(e) => setMaxCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="mt-1 bg-white"
                disabled={disabled}
              />
            </div>
          )}

          {/* End Date (if on_date) */}
          {endCondition === "on_date" && (
            <div>
              <Label className="text-sm">End date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1 bg-white"
                    disabled={disabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => {
                      const minDate = currentDueDate ? new Date(currentDueDate) : new Date();
                      return date < minDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-md p-3 border border-purple-200">
            <div className="flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-purple-900">{getRecurrenceSummary()}</div>
                <div className="text-gray-600 text-xs mt-1">
                  When you complete this task, a new instance will be automatically created with an updated due date.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

RecurringTaskForm.propTypes = {
  value: PropTypes.shape({
    isRecurring: PropTypes.bool,
    recurrencePattern: PropTypes.object,
  }),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  currentDueDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};