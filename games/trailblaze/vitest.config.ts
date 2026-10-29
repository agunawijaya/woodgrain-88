import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'trailblaze',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
