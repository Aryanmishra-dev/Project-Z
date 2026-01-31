module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting
        'refactor', // Code restructuring
        'perf',     // Performance
        'test',     // Tests
        'chore',    // Maintenance
        'revert',   // Revert commit
        'ci',       // CI/CD
        'build',    // Build system
      ],
    ],
    'subject-case': [2, 'never', ['upper-case']],
  },
};
