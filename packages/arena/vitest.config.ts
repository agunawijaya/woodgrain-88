import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'arena',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
