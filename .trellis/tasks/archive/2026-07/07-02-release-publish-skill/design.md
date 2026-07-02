# Design: Release publish workflow skill

## Scope

This task has two deliverables:

1. A reusable project-level Pi skill for release/publish work.
2. The immediate `0.7.4` release/publish execution.

## Skill placement and structure

- Directory: `.pi/skills/yolk-release-publish/`
- Entry file: `.pi/skills/yolk-release-publish/SKILL.md`
- Skill name: `yolk-release-publish`
- Frontmatter description should mention concrete triggers: release, version bump, tag, push, npm publish, `ypi`, and `@alan-zhao/yolk-pi-web`.

The skill will be self-contained enough to guide future agents, but it should reference authoritative project docs instead of duplicating everything:

- `AGENTS.md`
- `docs/deployment/README.md`
- `package.json`

## Release versioning approach

Use manual patch bump editing rather than `npm version patch` for this task because Trellis task files are intentionally dirty until finish-work. The release commit should include only durable release files, while task archive/journal commits are created later by Trellis.

Required version files:

- `package.json`
- `package-lock.json`

Expected version:

- `0.7.4`
- tag `v0.7.4`

## Commit and publish order

1. Implement skill and version update.
2. Run validation.
3. Commit release files, e.g. `chore: release 0.7.4`.
4. Push `main` to `origin`.
5. Create tag `v0.7.4` on the release commit.
6. Push tag to `origin`.
7. Run `npm publish --access public`.
8. Verify with `npm view @alan-zhao/yolk-pi-web version --prefer-online`.
9. Finish Trellis work, which creates archive and journal commits after the work release commit.

## Guardrails

- Never commit npm tokens or auth config.
- Never push to `upstream`.
- Do not use `next build` directly; use `npm run build`.
- Stop before publishing if validation fails.
- Stop if npm registry already contains the intended version.
- Keep Trellis archive/journal commits after the release commit.
