import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'hot-and-cold',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
