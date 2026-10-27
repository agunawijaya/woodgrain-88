/**
 * What each Neighbourhood Kid says after a match, in their own voice: three
 * lines for a win, a loss and a draw. The line is picked by a seed, so the
 * same result always says the same thing.
 */
import type { KidId } from '@woodgrain-88/kit';

export type KidMood = 'won' | 'lost' | 'draw';

/** Three short lines per Kid per mood, said after a match. */
export const KID_LINES: Readonly<Record<KidId, Readonly<Record<KidMood, readonly string[]>>>> = {
  dee: {
    won: [
      'Ha! Too fast for you. Told you, I never brake!',
      'Straight down the middle. Works every time!',
      'Blink and you miss me. You blinked!',
    ],
    lost: [
      'Rematch! I wasn’t even warmed up yet!',
      'Okay, okay. Next time I go in twice as fast.',
      'Lucky shot! Run it back, right now!',
    ],
    draw: [
      'A tie? Nope. We go again. Now!',
      'Even? Not for long. Rematch!',
      'Dead heat. My tank wants another go!',
    ],
  },
  moss: {
    won: [
      'You left a gap. I waited for it.',
      'Slow is smooth. Smooth wins.',
      'Every shot you took, I saw coming.',
    ],
    lost: [
      'You found the one gap. Well played.',
      'Noted. That won’t work twice.',
      'Patience lost to nerve today. Fair.',
    ],
    draw: [
      'Neither of us gave an inch.',
      'Even. I can live with even.',
      'A draw. We read each other well.',
    ],
  },
  pip: {
    won: [
      'I won? I was aiming at the wall! Hee!',
      'Boing, boing, BOOM! Did you see that?',
      'Wheee! Let’s do the bouncy one again!',
    ],
    lost: [
      'Kaboom! That was the best explosion yet!',
      'Oops, I was looking at the clouds. Again?',
      'Hee hee, I spun like a top! Again, again!',
    ],
    draw: [
      'We both went boom! Twins!',
      'Nobody won, so we both get a sticker!',
      'A tie! Even my tank is giggling.',
    ],
  },
  lou: {
    won: [
      'Steady hands, kiddo. They come with time.',
      'Read the walls, kiddo. They’ll talk to you.',
      'Good scrap, kiddo. You’ll have me soon.',
    ],
    lost: [
      'Well I’ll be. You got the old man, kiddo!',
      'That bank was a beauty, kiddo. Fair and square.',
      'Sharp eyes, kiddo. Don’t tell my friends.',
    ],
    draw: [
      'Even steven, kiddo. Shake on it?',
      'Neither of us blinked, kiddo. Good game.',
      'A draw, kiddo. Same time tomorrow?',
    ],
  },
  rosa: {
    won: [
      'You fell for the curl. They always do.',
      'Left you an opening. You took it. Oops!',
      'Looked one way, fired the other. Sorry!',
    ],
    lost: [
      'You didn’t take the bait? Rude. Clever.',
      'Fine, you saw through me. This time.',
      'Hmph. The next trap is a better trap.',
    ],
    draw: [
      'Both of us scheming. Nobody fell for it.',
      'A draw? I had a plan for this, too.',
      'Even. I’ll think of something sneakier.',
    ],
  },
  benny: {
    won: [
      'You always turn left after a hit. Noted!',
      'I copied your favourite lane. Thanks!',
      'Your rhythm is fire, wait, fire. I learned it.',
    ],
    lost: [
      'New trick! Let me write that one down.',
      'You changed your pattern. Not in my notes!',
      'I’ll study that shot all week. Again?',
    ],
    draw: [
      'We mirrored each other move for move!',
      'Same moves, same score. Fascinating.',
      'Copying you is harder than it looks.',
    ],
  },
};

/** One line, picked by `seed` so a replayed result says the same thing. */
export function kidLine(kid: KidId, mood: KidMood, seed: number): string {
  const lines = KID_LINES[kid][mood];
  return lines[Math.floor(Math.abs(seed)) % lines.length] ?? '';
}
