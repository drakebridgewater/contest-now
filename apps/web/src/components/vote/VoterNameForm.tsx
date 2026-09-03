import { VOTER_NAME_MIN } from '@contest/shared';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { TextField, Toggle } from '../ui/Field.tsx';

export function VoterNameForm({
  onSubmit,
  sharedDevice,
  onSharedDeviceChange,
}: {
  onSubmit: (name: string) => void;
  sharedDevice: boolean;
  onSharedDeviceChange: (value: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-bold">What&apos;s your name?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Your ratings are saved under this name, so you can come back and change them all evening.
          Use the same name each time.
        </p>
      </div>

      <TextField
        label="Your name"
        placeholder="e.g. Sam"
        value={name}
        autoComplete="name"
        enterKeyHint="go"
        error={error}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />

      <Toggle
        label="This is a shared device"
        help="Signs you out automatically after 60 seconds of inactivity, so the next guest starts fresh."
        checked={sharedDevice}
        onChange={onSharedDeviceChange}
      />

      <Button size="lg" className="w-full" onClick={submit}>
        <LogIn className="size-5" aria-hidden="true" />
        Start voting
      </Button>
    </Card>
  );

  function submit() {
    if (name.trim().length < VOTER_NAME_MIN) {
      setError(`Enter at least ${VOTER_NAME_MIN} characters`);
      return;
    }
    onSubmit(name);
  }
}
