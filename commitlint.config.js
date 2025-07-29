module.exports = {
    extends: ['@commitlint/config-angular'],
    rules: {
        'subject-case': [
            2,
            'always',
            [
                'sentence-case',
                'start-case',
                'pascal-case',
                'upper-case',
                'lower-case',
            ],
        ],
        'scope-enum': [1, 'always'],
        'type-enum': [
            2,
            'always',
            [
                'build',
                'ci',
                'docs',
                'feat',
                'fix',
                'refactor',
                'perf',
                'test',
                'style',
                'chore',
                'deps',
            ],
        ],
    },
};
