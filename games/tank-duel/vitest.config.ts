import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'tank-duel',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
