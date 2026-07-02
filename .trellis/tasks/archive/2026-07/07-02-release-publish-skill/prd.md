# Prepare next release and publish skill

## Goal

Prepare and publish the next npm release of `@alan-zhao/yolk-pi-web`, push the release commits/tags, and add a reusable project-level Pi skill that guides future release/publish work.

## Background / Confirmed Facts

- The current branch is `main`.
- The working tree was clean before task creation; the only current dirty path is this Trellis task directory.
- The latest local and npm-published package version is `0.7.3`.
- Existing release tags include `v0.7.3`, `v0.7.2`, `v0.7.1`, and `v0.7.0`.
- `npm whoami` succeeds as `zhaoyujie950128`.
- Release documentation in `docs/deployment/README.md` requires `npm whoami`, lint, type-check, build, and `npm pack --dry-run` before `npm publish --access public`.
- Pi project-level skills are discovered from `.pi/skills/` directories containing `SKILL.md`.

## Requirements

1. Version and release notes
   - Increment the project version from `0.7.3` to the next patch version, `0.7.4`.
   - Keep `package.json` and `package-lock.json` versions in sync.
   - Add/update project release guidance so future agents can repeat the flow safely.

2. Project-level release skill
   - Add a project Pi skill under `.pi/skills/` for the Yolk Pi Web release/publish workflow.
   - The skill must load on requests to release, bump version, tag, push, or publish this project.
   - The skill must explicitly require validation before npm publish and must avoid committing secrets/tokens.
   - The skill must separate work commits from Trellis archive/journal commits.

3. Release validation and publishing
   - Run release validation before publish:
     - `npm whoami`
     - `npm run lint`
     - `node_modules/.bin/tsc --noEmit`
     - `npm run build`
     - `npm pack --dry-run`
   - Commit the version/skill/release-info changes before tagging.
   - Create and push tag `v0.7.4`.
   - Push `main` to `origin`.
   - Publish `@alan-zhao/yolk-pi-web@0.7.4` to npm with public access.
   - Verify npm registry shows `0.7.4` after publishing.

## Acceptance Criteria

- [x] A project-level release/publish skill exists and follows Pi skill frontmatter/structure rules.
- [x] `package.json` and `package-lock.json` both report version `0.7.4`.
- [x] Release validation commands complete successfully or any blocker is documented before stopping.
- [x] A release commit exists before Trellis archive/journal commits.
- [x] `main` is pushed to `origin`.
- [x] Git tag `v0.7.4` exists locally and is pushed.
- [x] npm registry reports `@alan-zhao/yolk-pi-web` version `0.7.4`.
- [x] Final summary lists the release commit, tag, npm version, and validation commands.

## Completion Notes

- Release commit: `c26283e chore: release 0.7.4`.
- Local and pushed tag: `v0.7.4` -> `c26283e`.
- Pushed `main` to `origin`; `origin/main` matches `HEAD`.
- Published `@alan-zhao/yolk-pi-web@0.7.4` with public access.
- Registry verification:
  - `npm view @alan-zhao/yolk-pi-web@0.7.4 version --prefer-online` -> `0.7.4`.
  - `npm dist-tag ls @alan-zhao/yolk-pi-web` -> `latest: 0.7.4`.
  - `npm view @alan-zhao/yolk-pi-web version --prefer-online` -> `0.7.4` after registry propagation.
- Validation completed before publish:
  - `npm whoami` -> `zhaoyujie950128`.
  - `npm run lint` passed.
  - `node_modules/.bin/tsc --noEmit` passed.
  - `npm run build` passed with existing Next.js warnings for `app/api/sessions/[id]/export/route.ts` dynamic dependency and Node `[DEP0205]` deprecation.
  - `npm pack --dry-run` passed.
- Focused Trellis check subagent review found no blockers.

## Out of Scope

- Publishing to any package name other than `@alan-zhao/yolk-pi-web`.
- Changing package ownership or npm authentication configuration beyond read-only checks.
- Pushing to `upstream`.
- Running production deployment outside npm publish.
