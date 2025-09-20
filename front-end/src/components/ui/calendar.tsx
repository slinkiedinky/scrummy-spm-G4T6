"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import "react-day-picker/dist/style.css"

export type { DayPickerProps }

export function Calendar(props: DayPickerProps) {
  return (
    <div className="rounded-md border bg-background p-2">
      <DayPicker {...props} />
    </div>
  )
}
