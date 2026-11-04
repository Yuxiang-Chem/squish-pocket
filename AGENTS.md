# Squish Pocket project instructions

- `/Users/chem/squish-pocket-github` is the single source repository. The old
  `/Users/chem/SquishPocket` path is an alias to it, not another checkout.
- The GitHub repository is the official source. Preserve its history and remote.
- Use test/feature branches for unapproved candidate commits; keep `main` for
  official releases. Do not push candidate changes to `main` before approval.
- Ship fixes and new features to the test site first. A general request to fix
  or update the game authorizes the test release only.
- Test: `https://squish-test.chemisgreat.online/`, Worker `squish-pocket-test`,
  database `squish-pocket-achievements-test`.
- Official: `https://squish.chemisgreat.online/`, Worker `squish-pocket`,
  database `squish-pocket-achievements`.
- Use one game source (`browser/dist` and `cloudflare/*.js`) with separate
  deployment configurations. Do not make a second game folder for testing.
- Run `npm run deploy:test` from the repository root to check, migrate, publish,
  and verify a test candidate. It never targets official resources.
- Publish the official game only when the user explicitly requests promotion
  of a tested candidate. Use `npm run deploy:production -- --tested-version ID`;
  the release guard requires the exact source already verified on the test site.
- Do not bypass the release guard or run production Wrangler deployment/migration
  commands for routine fixes. Follow `RELEASING.md` for the promotion sequence.
- Keep test achievements, multiplayer rooms, and browser saves separate from
  official play. Test email delivery stays disabled.
- Preserve archived legacy files and the local Sites binding. Neither is a
  deployment source for the current public test or official game.
