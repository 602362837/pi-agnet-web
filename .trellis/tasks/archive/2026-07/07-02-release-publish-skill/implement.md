# Implementation Plan

## Pre-start checks

- Confirm user accepts releasing patch version `0.7.4`.
- Confirm no push to `upstream`.

## Steps

1. Create project skill
   - Add `.pi/skills/yolk-release-publish/SKILL.md`.
   - Include frontmatter with valid name and targeted description.
   - Include release checklist, validation commands, commit/tag/publish order, and safety rules.

2. Update version information
   - Update `package.json` version from `0.7.3` to `0.7.4`.
   - Update `package-lock.json` root/package version fields to `0.7.4`.
   - If release notes are added to docs, keep them concise and point future agents to the skill.

3. Validate
   - `npm whoami`
   - `npm run lint`
   - `node_modules/.bin/tsc --noEmit`
   - `npm run build`
   - `npm pack --dry-run`

4. Commit release work
   - Inspect dirty state.
   - Commit only release/skill/version files, not Trellis task files.
   - Suggested message: `chore: release 0.7.4`.

5. Push/tag/publish
   - `git push origin main`
   - `git tag v0.7.4 <release-commit>`
   - `git push origin v0.7.4`
   - `npm publish --access public`
   - Verify `npm view @alan-zhao/yolk-pi-web version --prefer-online` returns `0.7.4`.

6. Finish Trellis
   - Update PRD acceptance/completion notes.
   - Run finish-work to archive task and record journal.

## Rollback / stop points

- If validation fails: stop, report blocker, do not publish.
- If `npm view` already reports `0.7.4`: stop before publish and inspect whether the version was already released.
- If push/tag fails: stop before publish unless user explicitly confirms an alternate recovery.
- If npm publish fails after tag push: report exact npm error and leave tag/release commit for manual recovery or patch follow-up.
