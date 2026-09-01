# Chordkit 提交、PR 与 npm 发布流程

本文档是 Chordkit 的唯一 Git 与发布操作手册。当前稳定主线是 `main`；npm 使用 GitHub Actions **Trusted Publishing**，真实发布仅由 `v*` Git tag 触发。

## 1. 日常开发

### 开始前

```bash
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short --branch
npm ci
```

开始前必须确认：

- `main` 已和 `origin/main` 同步；
- 没有未解释的修改、Tag 或本地 Commit；
- 不提交 `node_modules/`、`dist/`、`coverage/`、`.idea/`、临时包文件或本机配置；
- `package-lock.json` 与 `package.json` 同步。

### 创建工作分支

不直接在 `main` 上开发。分支格式：

```text
<type>/<short-description>
```

```bash
git switch -c feat/pipeline-cache
git switch -c fix/midi-stream-watermark
git switch -c docs/commit-workflow
```

常用 type：`feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`chore`。

## 2. Commit 规范

使用 Conventional Commits：

```text
<type>(<scope>): <summary>
```

示例：

```text
feat(pipeline): add stable event stream API
fix(publish): prepare npm trusted publishing
refactor(midi): share timeline analyzer injection
test(pipeline): cover cache and snapshot contracts
docs(release): document tag publication workflow
```

规则：

- summary 使用英文祈使句、小写开头、无句号，建议不超过 72 字符；
- 一个 Commit 只处理一个可审查主题；
- 生产代码、测试、文档、CI 可拆开提交；若同一变更不可分割，可以放进同一个 Commit；
- 不使用 `update`、`fix stuff`、`wip` 之类无语义消息。

提交前检查暂存内容：

```bash
git status --short
git diff
git diff --cached
git diff --check
```

只暂存本次相关文件：

```bash
git add src/pipeline tests/pipeline.test.ts docs/PIPELINE.md
git commit -m "feat(pipeline): add analyzer cache controls"
```

## 3. 本地验证

功能分支提交前，至少执行：

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
git diff --check
```

准备 PR 或发布时执行完整检查：

```bash
npm ci
npm run ci
npm run build
npm pack --dry-run
git diff --check
```

验收要求：

- `npm run ci` 通过；
- `npm run build` 同时生成 ESM、CJS 和 `.d.ts`；
- `npm pack --dry-run` 包含 `dist/`、`README.md`、`LICENSE`，不包含 IDE、测试、coverage 或临时文件；
- 公开 API、类型定义、测试与文档一致。

## 4. Push 与 Pull Request

首次推送分支：

```bash
git push --set-upstream origin <branch-name>
```

后续推送：

```bash
git push origin <branch-name>
```

创建 PR 前同步主线：

```bash
git fetch origin
git rebase origin/main
npm run ci
npm run build
npm pack --dry-run
git push --force-with-lease origin <branch-name>
```

PR 必须指向 `main`，描述至少包含：

```markdown
## Summary
- 修改目标与用户可见影响

## API / Compatibility
- 新增或变更的导出、类型、行为
- legacy / MIDI / pipeline 兼容性

## Validation
- npm run ci
- npm run build
- npm pack --dry-run

## Release notes
- 是否需要版本升级
- 是否包含发布工作流或 npm 元数据修改
```

合并条件：

- CI 的 Node 22 与 Node 24 job 均成功；
- `Publish to npm / Verify package` 成功；
- PR 不包含未解释的生成物、IDE 配置或敏感文件；
- 分支无冲突并完成审查。

## 5. CI 与 Publish Workflow

### CI：`.github/workflows/ci.yml`

所有 push 和 PR 都会执行：

- Node 22、Node 24；
- `npm ci`；
- typecheck；
- coverage 测试；
- coverage artifact 上传。

### Publish：`.github/workflows/publish.yml`

| 触发方式 | `Verify package` | 真实 npm 发布 |
| --- | --- | --- |
| Pull Request | 执行 | 不执行 |
| `workflow_dispatch` | 执行 | 不执行 |
| Push `v*` Tag | 执行 | 执行 |

`Verify package` 固定运行：

```text
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

真实 publish job 仅在 `refs/tags/v*` 上运行，并在验证通过后：

```text
npm install --global npm@latest
npm publish --access public
```

npm 包 `@phishinqi/chordkit` 必须在 npm Settings → Trusted Publishers 中绑定：

```text
Provider: GitHub Actions
Owner: phishinqi
Repository: Chordkit
Workflow: publish.yml
Environment: 留空
```

不要在 GitHub Secrets 中维护长期 npm token；Trusted Publishing 依赖 workflow 的 `id-token: write` 权限。

## 6. 正式发布

发布只能从已合并、已验证的 `main` 发起。

### 选择版本

| 目标 | 命令 | 示例 |
| --- | --- | --- |
| 修复 | `npm version patch` | `0.1.1 → 0.1.2` |
| 兼容新功能 | `npm version minor` | `0.1.1 → 0.2.0` |
| 破坏性变更 | `npm version major` | `0.1.1 → 1.0.0` |

### 标准发布命令

```bash
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short --branch

npm ci
npm run ci
npm run build
npm pack --dry-run

npm version patch
git push origin main --follow-tags
```

`npm version` 会同时：

1. 更新 `package.json` 和 `package-lock.json`；
2. 创建版本 Commit；
3. 创建对应 Tag，例如 `v0.1.2`。

`git push origin main --follow-tags` 会推送版本 Commit 和 annotated Tag。Tag push 触发真实 npm 发布。

### 发布后确认

```bash
npm view @phishinqi/chordkit version --registry=https://registry.npmjs.org
npm view @phishinqi/chordkit@<VERSION> dist.tarball --registry=https://registry.npmjs.org
git ls-remote --tags origin refs/tags/v<VERSION>
```

并在 GitHub Actions 中确认：

```text
Verify package: success
Publish to npm: success
```

## 7. 发布失败恢复

### main 推送被拒绝

这表示本地 `main` 已落后远端。不要 force push：

```bash
git fetch origin --prune
git rebase origin/main
git push origin main
```

如果版本 Commit 已在错误分支生成，先确认该版本尚未发布，再将版本 Commit 重新落到最新 `main`；不要直接从旧功能分支推送到 `main`。

### Tag 已推送但 npm 发布失败

先检查 npm registry：

```bash
npm view @phishinqi/chordkit@<VERSION> version --registry=https://registry.npmjs.org
```

- 若 registry 已存在该版本：**绝不移动 Tag，也不尝试重复发布**；修复问题后使用下一个版本。
- 若 registry 不存在该版本：修复 workflow 或 npm Trusted Publisher 配置、将修复提交推到 `main`，然后让同一个 Tag 指向修复后的 `main` 并重新触发：

```bash
git switch main
git pull --ff-only origin main
git tag -f v<VERSION> HEAD
git push origin refs/tags/v<VERSION>:refs/tags/v<VERSION> --force
```

这是未发布版本的恢复手段，不是常规流程。

### Trusted Publishing 报 npm `E404` / `ENEEDAUTH`

检查：

1. npm Trusted Publisher 的 owner、repository、workflow filename 是否准确；
2. workflow 是否具有：

   ```yaml
   permissions:
     contents: read
     id-token: write
   ```

3. publish job 是否在 `npm publish` 前运行最新版 npm；
4. `package.json` 是否包含 GitHub `repository` 元数据；
5. Tag 是否指向包含修复 workflow 的 Commit。

## 8. 回滚

### 未提交修改

```bash
git restore <file>
git restore --staged <file>
```

### 已推送但未合并的分支

```bash
git revert <commit-sha>
git push origin <branch-name>
```

rebase 后只使用受保护强推：

```bash
git push --force-with-lease origin <branch-name>
```

### 已合并 main

使用反向 Commit：

```bash
git revert <commit-sha>
git push origin main
```

不要改写公共 `main` 历史。

### 已发布 npm 版本

npm 版本不可覆盖。修复必须使用新的 semver 版本；如需撤下错误版本，在 npm 标记为 deprecated，并发布修复版本。

## 9. 最短操作清单

```text
功能开发：main 同步 → 新分支 → 修改 + 测试 → npm run ci/build/pack → PR → CI 通过 → merge main

正式发布：main 同步 → npm run ci/build/pack → npm version patch|minor|major → git push origin main --follow-tags → 等待 Publish to npm success → npm view 确认

发布失败：先 npm view 检查版本是否已存在；未发布才修 workflow/Trusted Publisher 并重指 Tag，已发布则升新版本。
```
