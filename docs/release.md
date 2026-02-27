## Release API Process

### How to make release?

1. Bump package version inside `api/package.json`
2. Open PR to `main` and merge PR
3. Check status inside Github Actions

NOTE: Action for release is triggered only when version change is detected.
