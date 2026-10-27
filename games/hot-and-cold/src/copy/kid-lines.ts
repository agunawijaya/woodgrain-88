/**
 * What each Neighbourhood Kid says after a Hot & Cold match, in their own
 * voice: three lines for a win, a loss and a draw, and how they sum up their
 * own memory for the results panel. A line is picked by a seed, so the same
 * result always says the same thing.
 */
import type { KidId } from '@woodgrain-88/kit';

export type KidMood = 'won' | 'lost' | 'draw';

export const KID_LINES: Readonly<Record<KidId, Readonly<Record<KidMood, readonly string[]>>>> = {
  dee: {
    won: [
      'Dig first, think later. Works for me!',
      'I heard "warm" and just ran. Flag!',
      'Too slow! I was already digging the next one.',
    ],
    lost: [
      'I forgot where the hot numbers were. Again!',
      'Okay, maybe I should read the arrows. Rematch!',
      'That bomb came out of nowhere. Go again, now!',
    ],
    draw: [
      'Even? Nope. One more field!',
      'A tie means we both dig again.',
      'Same score! My shovel wants a rematch.',
    ],
  },
  moss: {
    won: [
      'Two clues crossed on one square. I only had to wait.',
      'Every number I dug, I wrote down in my head.',
      'You checked the edges. I checked the middle.',
    ],
    lost: [
      'You read the field faster than I did. Noted.',
      'I was one clue short. Well found.',
      'Careful lost to quick today. Fair enough.',
    ],
    draw: [
      'We read the same field the same way.',
      'Even. I can live with even.',
      'Neither of us guessed. Good.',
    ],
  },
  pip: {
    won: [
      'I was digging for worms and found a flag!',
      'Hee! I followed an arrow the wrong way and it worked!',
      'Lucky dig! Do I get to keep the flag?',
    ],
    lost: [
      'Was it a 3 or an 8? I forget. Hee!',
      'Kaboom! That bomb was the best part.',
      'I think the flag moved. Or I did. Again?',
    ],
    draw: [
      'We both found nothing at the same time!',
      'A tie! Let’s dig a really big hole next.',
      'Same score! Snow angels, then rematch.',
    ],
  },
  lou: {
    won: [
      'A little warmer, a little warmer… there it was.',
      'I keep every clue in a neat row up here.',
      'No hurry. The flag was never going anywhere.',
    ],
    lost: [
      'Well now. You remembered more than I did.',
      'Sharp young eyes. Well played.',
      'I was still wiping my glasses. Well found.',
    ],
    draw: [
      'Neck and neck, as it should be.',
      'A fine draw. Shall we dig again?',
      'Even. My knees say that’s plenty for today.',
    ],
  },
  rosa: {
    won: [
      'Every square you dug, I read too. Thanks for the help!',
      'You walked right past it. I was watching.',
      'I let you find the clues. Then I found the flag.',
    ],
    lost: [
      'You stopped showing me your clues. Clever.',
      'Hmm. I was watching you instead of the field.',
      'You were too quick to follow. Next time.',
    ],
    draw: [
      'We copied each other all the way down.',
      'Even, and I still know what you were up to.',
      'A draw. You hide your clues well.',
    ],
  },
  benny: {
    won: [
      'I dug where you dug, just a bit sooner!',
      'Your way works great. I tried it first!',
      'Learned it from you. Thanks, teacher!',
    ],
    lost: [
      'How did you know? Show me again!',
      'I copied the wrong clue. Next time.',
      'You changed how you play. Not fair! Again!',
    ],
    draw: [
      'Same moves, same score. Twins!',
      'I copied you so well we tied.',
      'Even! I’m getting the hang of this.',
    ],
  },
};

/** How each Kid introduces their memory in the results panel. */
export const MEMORY_INTROS: Readonly<Record<KidId, string>> = {
  dee: 'Dee remembers loudly and briefly.',
  moss: 'Moss goes over her clues again and again.',
  pip: 'Pip’s memory goes where Pip goes.',
  lou: 'Grandpa Lou forgets very little, very slowly.',
  rosa: 'Rosa watches your clues more than her own.',
  benny: 'Benny keeps a close eye on yours.',
};

/** A line for a Kid after a match, picked by `seed`. */
export function kidLine(kid: KidId, mood: KidMood, seed: number): string {
  const lines = KID_LINES[kid][mood];
  return lines[Math.abs(Math.trunc(seed)) % lines.length] ?? lines[0] ?? '';
}
