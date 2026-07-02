# Release Evidence

## Current repository state

- Branch: `main`.
- Working tree was clean before task creation; only this Trellis task directory is untracked.
- Remotes:
  - `origin`: `git@github.com:602362837/pi-agnet-web.git`
  - `upstream`: `git@github.com:twofive1203/pi-agnet-web.git`

## Current package / registry state

- `package.json` name: `@alan-zhao/yolk-pi-web`.
- Local package version: `0.7.3`.
- Latest npm registry version from `npm view @alan-zhao/yolk-pi-web version --prefer-online`: `0.7.3`.
- Authenticated npm user from `npm whoami`: `zhaoyujie950128`.
- Existing version tags: `v0.7.3`, `v0.7.2`, `v0.7.1`, `v0.7.0`.

## Release docs

`docs/deployment/README.md` says npm releases should validate with:

```bash
npm whoami
npm run lint
node_modules/.bin/tsc --noEmit
npm run build
npm pack --dry-run
```

Publish command:

```bash
npm publish --access public
```

It also documents `npm run release:patch`, but for this task a manual version bump is safer because the active Trellis task directory keeps the worktree dirty until finish-work archives it. Manual bump avoids forcing `npm version` through a dirty worktree.

## Pi skill docs

`node_modules/@earendil-works/pi-coding-agent/docs/skills.md` says project skills are discovered from `.pi/skills/`, and each directory skill uses a `SKILL.md` file with frontmatter fields:

- `name`: required, lowercase letters/numbers/hyphens, max 64 chars.
- `description`: required, max 1024 chars, specific trigger guidance.

Relative references in a skill should be resolved from the skill directory.
