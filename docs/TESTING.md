# Testing / 测试

```bash
npm ci
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The suite uses Vitest fixture tests plus fast-check properties. It covers templates, inversions, omissions, compound interval semantics, advanced relations, malformed input, and deterministic ranking.

Coverage uses the V8 provider and requires at least 80% statements, branches, functions, and lines across the core implementation.

## 中文说明

每个新增模板、命名规则或排序规则必须同时增加 fixture。任何涉及 2/9、4/11、6/13 的改动都必须同时覆盖带 register 与无 register 两种输入。

