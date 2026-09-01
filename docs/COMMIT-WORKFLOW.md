# Chordkit 代码提交与发布流程

本文档定义 Chordkit 的本地开发、分支、Commit、验证、Push、Pull Request 和回滚流程。

## 1. 开发前检查

```bash
git status --short --branch
git fetch origin
git log --oneline --decorate -8
npm ci
```

开发前确认：

- 当前处于正确的功能分支；
- 工作区没有未说明的修改；
- 本地依赖来自 `package-lock.json`；
- 不直接在 `main` 上开发；
- 不提交 `node_modules/`、`dist/`、`coverage/` 或临时编译目录。

## 2. 分支策略

### 主分支

```text
main
```

`main` 必须保持可审查、可构建、可测试。所有功能通过 Pull Request 合并。

### 功能分支

分支命名格式：

```text
<type>/<short-description>
```

示例：

```text
refactor/core-chord-engine
feat/midi-timeline
fix/compound-interval-matching
test/legacy-parity

docs/commit-workflow
```

创建分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/short-description
```

## 3. Commit 分类

使用 Conventional Commits 风格：

```text
<type>(<scope>): <summary>
```

推荐类型：

| Type | 使用场景 |
| --- | --- |
| `feat` | 新增公开能力或用户可见功能 |
| `fix` | 修复错误行为 |
| `refactor` | 不改变公开行为的内部重构 |
| `test` | 新增或调整测试 |
| `docs` | 文档、注释、迁移说明 |
| `chore` | 构建、依赖、CI、工具配置 |
| `perf` | 性能优化 |
| `revert` | 回滚已有 Commit |

Scope 示例：

```text
core
midi
segmentation
templates
legacy
scoring
ci
release
```

正确示例：

```text
feat(midi): add Standard MIDI File parser
feat(segmentation): add onset-aware chord windows
fix(intervals): preserve compound ninth semantics
refactor(core): split chord engine into typed modules
test(midi): cover sustain and running status
docs(api): document timeline analysis
chore(ci): run Node 22 and Node 24 checks
```

Commit summary 使用祈使句，首字母小写，不以句号结尾；建议控制在 72 个字符以内。

## 4. 推荐提交顺序

一个完整功能建议拆成以下独立 Commit：

### Commit 1：基础设施

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts .github .gitignore

git commit -m "chore(ci): add build and verification workflow"
```

内容包括：

- npm scripts；
- TypeScript 配置；
- 构建入口；
- Vitest/coverage 配置；
- GitHub Actions；
- `.gitignore` 与格式规范。

### Commit 2：生产代码

```bash
git add src
git commit -m "feat(midi): add timeline chord analysis"
```

内容包括：

- 生产 API；
- 类型定义；
- 业务逻辑；
- parser、tracker、segmentation、engine；
- 不包含测试和大段无关文档修改。

### Commit 3：测试

```bash
git add tests
git commit -m "test(midi): cover parser tracker and segmentation"
```

内容包括：

- 单元测试；
- fixture 测试；
- property-based 测试；
- 回归测试；
- 错误输入和边界条件测试。

### Commit 4：文档

```bash
git add README.md docs CONTRIBUTING.md CHANGELOG.md
git commit -m "docs(midi): document timeline API and workflow"
```

内容包括：

- README；
- API 使用说明；
- 架构说明；
- 迁移文档；
- 提交规范；
- Changelog。

## 5. 提交前验证

每次准备 Commit 前执行：

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm pack --dry-run
git diff --check
```

快速完整检查：

```bash
npm run ci
npm run build
```

验收条件：

- TypeScript 无错误；
- 所有测试通过；
- statements、branches、functions、lines coverage 均达到仓库配置门槛；
- ESM、CJS 和 `.d.ts` 均构建成功；
- `npm pack --dry-run` 不包含源码临时目录或敏感文件；
- `git diff --check` 无空白错误。

## 6. 查看和整理 Commit

查看工作区：

```bash
git status --short --branch
git diff
git diff --cached
```

查看最近提交：

```bash
git log --oneline --decorate --graph -12
```

提交前只加入相关文件：

```bash
git add src/core/chord/segmentation/types.ts
git add src/core/chord/segmentation/parseMidi.ts
git add tests/midi-timeline.test.ts
git commit -m "feat(midi): add Standard MIDI File parsing"
```

不要使用以下方式提交未经检查的全部内容：

```bash
git add .
git commit -m "update"
```

如果已经暂存了无关文件，先检查并取消暂存：

```bash
git restore --staged path/to/unrelated-file
```

## 7. Push 流程

首次推送功能分支：

```bash
git push --set-upstream origin <branch-name>
```

后续更新：

```bash
git push origin <branch-name>
```

Push 前再次确认：

```bash
git status --short --branch
git log --oneline origin/main..HEAD
git diff --check origin/main...HEAD
```

## 8. Pull Request 流程

Pull Request 的目标分支固定为：

```text
main
```

PR 标题沿用 Commit 风格，例如：

```text
feat(midi): add timeline chord analysis
```

PR 描述至少包含以下内容：

```markdown
## Summary
- 做了什么
- 新增了哪些 API
- 是否改变了已有行为

## Technical Changes
- 相关模块
- 数据流
- 兼容性处理

## Validation
- `npm run typecheck`
- `npm test`
- `npm run test:coverage`
- `npm run build`

## Compatibility
- 静态 `analyzeChord()` 是否保持兼容
- `/legacy` 是否保持兼容
- 是否存在迁移说明

## Review Notes
- 需要重点审查的算法或理论边界
- 已知限制
```

PR 合并前必须满足：

- GitHub Actions Node 22 通过；
- GitHub Actions Node 24 通过；
- coverage 门槛通过；
- 无未解释的 failing test、skip 或 todo；
- PR diff 不包含构建产物、IDE 配置或临时文件；
- API、README 和测试契约一致。

## 9. 复杂功能的 Commit 拆分规则

### 静态和弦能力

推荐拆分：

```text
refactor(core): extract interval analysis
feat(templates): migrate chord vocabulary
test(core): add register-aware chord fixtures
docs(core): document candidate scoring
```

### MIDI 时间线能力

推荐拆分：

```text
feat(midi): add normalized event types
feat(midi): parse Standard MIDI File format 0 and 1
feat(midi): add tempo and time-signature maps
feat(segmentation): track active notes and sustain
feat(segmentation): build onset-aware chord windows
feat(segmentation): add incremental timeline engine
test(midi): cover parser and tracker edge cases
docs(midi): document timeline API
```

### Legacy 迁移

推荐拆分：

```text
refactor(templates): migrate legacy chord vocabulary
feat(legacy): add deprecated compatibility subpath
test(legacy): cover old input and option behavior
docs(legacy): add migration guide
```

## 10. Rebase 与冲突处理

同步远程主分支：

```bash
git fetch origin
git rebase origin/main
```

出现冲突时：

```bash
git status
git diff
# 手动解决冲突后
git add <resolved-file>
git rebase --continue
```

放弃本次 rebase：

```bash
git rebase --abort
```

功能分支已被远程使用时，rebase 后使用：

```bash
git push --force-with-lease origin <branch-name>
```

禁止使用无保护的强制推送：

```bash
git push --force
```

## 11. 回滚流程

### 未提交修改回滚

```bash
git restore path/to/file
```

取消暂存但保留修改：

```bash
git restore --staged path/to/file
```

### 回滚最近 Commit

保留修改内容：

```bash
git reset --soft HEAD~1
```

同时丢弃本地最近 Commit 修改前，先确认目标 Commit 和工作区状态：

```bash
git log --oneline -5
git status --short
```

### 已推送 Commit 回滚

优先使用反向 Commit：

```bash
git revert <commit-sha>
git push origin <branch-name>
```

不要改写已经合并到 `main` 的公共历史。

## 12. 发布前检查

本项目当前只准备可发布包配置，不在普通功能 PR 中执行 `npm publish`。

发布前执行：

```bash
npm ci
npm run ci
npm run build
npm pack --dry-run
git status --short --branch
```

确认 package 内容：

- `dist/index.js`；
- `dist/index.cjs`；
- `dist/index.d.ts`；
- `dist/midi.*`；
- `dist/legacy.*`；
- `README.md`；
- `LICENSE`；
- 不包含测试源码、coverage、临时文件和本地配置。

## 13. 当前 Chordkit 提交流程摘要

```text
修改代码
  ↓
补充 fixture / property test
  ↓
npm run typecheck
  ↓
npm test
  ↓
npm run test:coverage
  ↓
npm run build
  ↓
git diff --check
  ↓
按职责拆分 Commit
  ↓
push 功能分支
  ↓
创建或更新 Pull Request
  ↓
等待 Node 22/24 CI
  ↓
代码审查
  ↓
合并 main
```

所有生产代码、测试、文档和 CI 修改都必须遵循同一流程；任何理论规则变更都必须附带对应回归测试。
