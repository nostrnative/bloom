import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Color palette for events
export const EVENT_COLORS = [
  {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
  },
  {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
  },
  {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-300',
  },
  {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    darkBg: 'dark:bg-red-900/30',
    darkText: 'dark:text-red-300',
  },
  {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    darkBg: 'dark:bg-orange-900/30',
    darkText: 'dark:text-orange-300',
  },
  {
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-300',
    darkBg: 'dark:bg-teal-900/30',
    darkText: 'dark:text-teal-300',
  },
  {
    bg: 'bg-pink-100',
    text: 'text-pink-700',
    border: 'border-pink-300',
    darkBg: 'dark:bg-pink-900/30',
    darkText: 'dark:text-pink-300',
  },
  {
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
    darkBg: 'dark:bg-indigo-900/30',
    darkText: 'dark:text-indigo-300',
  },
];

// Generate consistent color for an event based on its ID
export function getEventColor(eventId: string) {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    const char = eventId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % EVENT_COLORS.length;
  return EVENT_COLORS[index];
}
