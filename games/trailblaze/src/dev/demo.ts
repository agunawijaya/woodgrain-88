/**
 * The Den TV demo on its own, at the TV's size, to check it before the Hall
 * shows it. Dev only. ?appearance=light|dark  ?still=1 (as with reduced motion)
 */
import { createTrailblazeDemo } from '../demo/demo.ts';

const params = new URLSearchParams(location.search);
const host = document.getElementById('tv');
if (!host) throw new Error('demo page needs #tv');
const demo = createTrailblazeDemo(host, 7, {
  appearance: params.get('appearance') === 'dark' ? 'dark' : 'light',
  reducedMotion: params.get('still') === '1',
  width: 320,
  height: 240,
});
host.append(demo.surface);
document.body.dataset.ready = 'true';
