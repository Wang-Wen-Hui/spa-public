# SPA · Scientific Presentation Agent

SPA 是面向科研文献汇报的 **Agent 工作流 + PPTX 排版引擎原型**。模型或使用者负责阅读论文、核查结论、规划叙事和编写结构化证据；脚本负责布局选择、备注装配、预览及检查。它不是独立聊天应用，也不包含模型、API 密钥或自动保证科学正确的功能。

## 在 Antigravity 中试用

1. 用 Antigravity 打开本文件夹，让 Agent 阅读 `AGENTS.md` 和 `SKILL.md`。模型、登录和联网权限由你的 Antigravity 环境提供；本项目不绑定特定服务。
2. 在终端验证核心逻辑（Node.js 22 或更新版本）：

   ```powershell
   node --test tests/*.test.mjs
   node scripts/build_pptx.js check examples/academic-blue.json
   ```

3. 在本机为论文创建工作区（不要将真实论文或个人资料提交到 GitHub）：

   ```powershell
   node scripts/init_project.mjs my-paper
   ```

4. 告诉 Agent 论文位置和目标。Agent 需阅读正文、图注及补充材料，参照 `docs/contract.md` 填写 `projects/my-paper/plan.json`，并检查科学证据与布局。演示 JSON 是虚构数据，不代表真实研究。

## PPTX 渲染依赖与运行边界

校验、布局规划和自动测试只依赖 Node.js 内置模块。**生成 PPTX / PNG 还需要 `@oai/artifact-tool`**：该运行库不随本仓库发布；在准备本仓库时，公开 npm 仓库对该包返回 404。Antigravity 是否提供兼容版本取决于实际环境，不能假设开箱即用。请使用有权使用的兼容运行时，并把 `SPA_NODE_MODULES` 指向包含 `@oai/artifact-tool` 的 `node_modules` 目录。

在 Windows 上，若同一台电脑已经安装带此运行库的 Codex 运行时，`run.ps1` 会尝试在当前 Windows 用户的缓存中发现它；也可自行设置：

```powershell
$env:SPA_NODE_MODULES = '<包含 @oai/artifact-tool 的 node_modules 目录>'
.\run.ps1 demo
```

演示会生成 `.build/academic-blue/` 和 `.build/academic-red/`，每个目录含 PPTX、渲染页图和 index.html。非 Windows 环境请配置 `SPA_NODE_MODULES` 后运行 `node scripts/build_pptx.js demo`。找不到渲染库时，仍可运行测试、建项目和验证计划；要独立于该运行库生成 PPTX，需要另行实现并验证兼容的渲染后端。

PDF 文本导入使用 Python 3 和 `pypdf`；插图后只读检查还需要 `Pillow`：

```powershell
python -m pip install pypdf Pillow
python scripts/intake_paper.py path/to/paper.pdf --out projects/my-paper/sources
```

PDF 导入只提取文字，不代替图像阅读。生成器默认提供可编辑图片占位框，是否嵌入原图由用户明确决定；复用论文图片应自行确认使用权限。

## 常用命令

```powershell
node scripts/build_pptx.js check projects/my-paper/plan.json
node scripts/build_pptx.js approve-outline projects/my-paper/plan.json '<用户对实际大纲的答复>'
node scripts/build_pptx.js build projects/my-paper/plan.json .build/my-paper
# 查看生成预览并得到用户对实际预览的答复
node scripts/build_pptx.js approve-preview projects/my-paper/plan.json .build/my-paper '<用户对实际预览的答复>'
node scripts/build_pptx.js deliver projects/my-paper/plan.json .build/my-paper output/my-paper.pptx
python scripts/validate_pptx.py output/my-paper.pptx
```

审批命令记录的必须是实际答复；检查通过不等于科学内容正确。`projects/`、`output/`、`.build/` 等默认由 `.gitignore` 排除。初始化或生成不得覆盖现有项目和交付文件。

## 仓库内容

- `SKILL.md`、`references/`：Agent 工作流程、科学核查、布局与讲者备注规则。
- `design-system/`、`engine/`：主题、布局、计划校验及渲染实现。
- `scripts/`、`tests/`、`examples/`：命令行入口、自动测试、合成示例。
- `config/user-preferences.json`：可按使用者需求修改的默认偏好。
- `docs/contract.md`：计划结构与证据字段。

这个公开副本未包含论文、原始模板截图、个人案例或已有项目。仓库尚未指定开源许可证；若准备公开授权他人使用，请由权利人决定许可证。
