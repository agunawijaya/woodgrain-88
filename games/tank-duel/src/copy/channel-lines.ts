/**
 * One line per channel for the channel dial and the details panel: what the
 * channel plays like, in a few words. Kept beside the rules (`engine/channels.ts`)
 * rather than inside them, so the engine never carries display copy.
 */
export const CHANNEL_LINES: Readonly<Record<string, string>> = {
  'game-1': 'Tanks steer their shells round the sandbag line.',
  'game-2': 'Guided shells through the ruined lanes of the Old Quarter.',
  'game-3': 'Straight shells in the Old Quarter: line up, then fire.',
  'game-4': 'Nowhere to hide: guided shells across the open field.',
  'game-5': 'The plainest duel: straight shells, open ground.',
  'game-6': 'Shells bounce off every wall of the Old Quarter.',
  'game-7': 'Bouncing shells on open ground: the walls are the border.',
  'game-8': 'Billiard: a shell only scores after it has bounced.',
  'game-9': 'Billiard in the Old Quarter: bank every shot.',
  'game-10': 'Unseen tanks steer their shells round the sandbags.',
  'game-11': 'Unseen tanks and guided shells in the Old Quarter.',
  'game-12': 'Unseen tanks, bouncing shells, a maze of ruins.',
  'game-13': 'Unseen tanks playing billiard behind the sandbags.',
  'game-14': 'The hardest pool: unseen tanks, banked shots only.',
  'game-15': 'Biplanes steer their shots between the clouds.',
  'game-16': 'Biplanes with straight shots and clouds to hide in.',
  'game-17': 'Machine guns: hold fire for short, fast bursts.',
  'game-18': 'Machine guns in an open sky: nowhere to hide.',
  'game-19': 'Two biplanes a side flying in pairs, guided shots.',
  'game-20': 'One giant bomber against three biplanes.',
  'game-21': 'Jets with guided shots weave through the clouds.',
  'game-22': 'Jets with straight shots and clouds for cover.',
  'game-23': 'Jets, guided shots, an open sky.',
  'game-24': 'Jets with straight shots in an open sky.',
  'game-25': 'Two jets a side in the clouds, guided shots.',
  'game-26': 'One jet against a flight of three.',
  'game-27': 'Two jets a side, straight shots, open sky.',
  'ricochet-royale': 'Only bank shots score, a point for every bounce.',
  blackout: 'Both tanks unseen; a radar sweep shows them now and then.',
  'ace-duel': 'Jets with an afterburner that runs dry if you lean on it.',
  'last-tank': 'One hit wins the round. First to five rounds.',
};
