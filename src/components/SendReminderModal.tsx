import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { nostrApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { ParsedEvent } from '@/lib/nostr-utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ContactSelector from './ContactSelector';

interface SendReminderModalProps {
  event: ParsedEvent;
  onClose: () => void;
}

export default function SendReminderModal({
  event,
  onClose,
}: SendReminderModalProps) {
  const { relays, nsec } = useAppStore();
  const [selectedPubkeys, setSelectedPubkeys] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeStr = format(new Date(event.start * 1000), 'PP p');
    setMessage(
      `Reminder: ${event.title}\nTime: ${timeStr}\n\n${event.description || ''}`
    );
  }, [event]);

  const handleSend = async () => {
    if (!nsec || selectedPubkeys.length === 0 || !message) return;
    setSending(true);
    setError(null);
    try {
      for (const pk of selectedPubkeys) {
        // Ensure we have a hex pubkey for the selected recipient
        const hexPubkey = pk.startsWith('npub')
          ? await nostrApi.parsePubkey(pk)
          : pk;

        await nostrApi.sendDirectMessage(nsec, hexPubkey, message, relays);
      }

      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to send reminder. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden p-0 dark:bg-zinc-900'>
        <DialogHeader className='border-b border-zinc-200 p-4 dark:border-zinc-800'>
          <DialogTitle>Send Reminder</DialogTitle>
        </DialogHeader>

        <div className='flex flex-1 flex-col gap-4 overflow-hidden p-4'>
          <div className='grid gap-2'>
            <ContactSelector
              selectedPubkeys={selectedPubkeys}
              onSelect={setSelectedPubkeys}
              multiple
            />
          </div>

          {/* Message Preview */}
          <div>
            <label className='mb-1 block text-xs font-medium text-zinc-500'>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className='h-24 w-full resize-none rounded-lg border border-zinc-200 p-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
            />
          </div>

          {error && (
            <div className='rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
              {error}
            </div>
          )}
        </div>

        <DialogFooter className='border-t border-zinc-200 p-4 dark:border-zinc-800'>
          <div className='flex justify-between'>
            <Button variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={selectedPubkeys.length === 0 || sending}
              className='gap-2'
            >
              <Send className='h-4 w-4' />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
