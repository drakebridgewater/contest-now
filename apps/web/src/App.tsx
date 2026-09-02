import { RATING_VALUES } from '@contest/shared';

export function App() {
  return (
    <main className="p-6 text-lg">
      Contest app scaffold. Ratings go from {RATING_VALUES[0]} to {RATING_VALUES.at(-1)}.
    </main>
  );
}
