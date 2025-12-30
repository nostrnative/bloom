import { NostrEvent } from './api';

export interface ParsedEvent {
  id: string;
  title: string;
  description: string;
  start: number;
  end?: number;
  location?: string;
  isAllDay: boolean;
  identifier: string;
  reminderMinutes?: number;
  createdAt: number;
  kind: number;
  calendarIds: string[];
  color?: string;
  pubkey: string;
  invitees: string[];
  isPrivate: boolean;
  parent?: string;
  freq?: string;
  until?: number;
}

export interface ParsedCalendar {
  id: string;
  name: string;
  description: string;
  identifier: string;
  eventCoordinates: string[];
}

export interface ParsedRSVP {
  id: string;
  pubkey: string;
  status: 'accepted' | 'declined' | 'tentative';
  eventId: string;
  createdAt: number;
}

export function parseNostrEvent(event: NostrEvent): ParsedEvent {
  let title = '';
  let start = 0;
  let end: number | undefined;
  let location = '';
  let identifier = '';
  let reminderMinutes: number | undefined;
  let color: string | undefined;
  const calendarIds: string[] = [];
  const invitees: string[] = [];
  let parent: string | undefined;
  let freq: string | undefined;
  let until: number | undefined;

  for (const tag of event.tags) {
    const [tagName, value] = tag;
    if (tagName === 'title') title = value;
    if (tagName === 'color') color = value;
    if (tagName === 'start') start = parseInt(value);
    if (tagName === 'end') end = parseInt(value);
    if (tagName === 'location') location = value;
    if (tagName === 'd') identifier = value;
    if (tagName === 'reminder') reminderMinutes = parseInt(value);
    if (tagName === 'parent') parent = value;
    if (tagName === 'freq') freq = value;
    if (tagName === 'until') until = parseInt(value);
    if (tagName === 'p') invitees.push(value);
    if (tagName === 'a' && value.startsWith('31924:')) {
      const parts = value.split(':');
      if (parts.length >= 3) {
        calendarIds.push(parts[2]);
      }
    }
  }

  return {
    id: event.id,
    title,
    description: event.content,
    start,
    end,
    location,
    isAllDay:
      event.kind === 31922 ||
      (!!end && end - start >= 86400 && isMidnight(start)),
    identifier,
    reminderMinutes,
    createdAt: event.created_at,
    kind: event.kind,
    calendarIds,
    color,
    pubkey: event.pubkey,
    invitees,
    isPrivate: event.is_private,
    parent,
    freq,
    until,
  };
}

function isMidnight(timestamp: number): boolean {
  const date = new Date(timestamp * 1000);
  return date.getHours() === 0 && date.getMinutes() === 0;
}

export function parseCalendar(event: NostrEvent): ParsedCalendar {
  let name = '';
  let description = '';
  let identifier = '';
  const eventCoordinates: string[] = [];

  for (const tag of event.tags) {
    const [tagName, value] = tag;
    if (tagName === 'name') name = value;
    if (tagName === 'description') description = value;
    if (tagName === 'd') identifier = value;
    if (tagName === 'a') eventCoordinates.push(value);
  }

  return {
    id: event.id,
    name: name || identifier,
    description: description || event.content,
    identifier,
    eventCoordinates,
  };
}

export function parseRSVP(event: NostrEvent): ParsedRSVP | null {
  if (event.kind !== 31925) return null;

  let status: 'accepted' | 'declined' | 'tentative' | null = null;
  let eventId = '';

  for (const tag of event.tags) {
    const [tagName, value] = tag;
    if (tagName === 'status') {
      if (['accepted', 'declined', 'tentative'].includes(value)) {
        status = value as 'accepted' | 'declined' | 'tentative';
      }
    }
    if (tagName === 'a') eventId = value;
    if (tagName === 'e' && !eventId) eventId = value;
  }

  if (!status || !eventId) return null;

  return {
    id: event.id,
    pubkey: event.pubkey,
    status,
    eventId,
    createdAt: event.created_at,
  };
}
