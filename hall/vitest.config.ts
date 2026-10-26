import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'hall',
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
    // Vitest blanks CSS imports by default; the contrast test reads the real tokens.
    css: { include: [/tokens\.css/] },
  },
});
