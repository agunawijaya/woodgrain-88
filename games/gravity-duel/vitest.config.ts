import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'gravity-duel',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
