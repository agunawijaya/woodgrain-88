import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'kit',
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
