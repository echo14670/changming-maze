# 参与开发

先读：

- [接口文档](docs/接口文档.md)
- [提交与协作说明](docs/提交与协作说明.md)

最短流程（有写权限）：

```bash
git switch main
git pull --ff-only
git switch -c feat/<成员>-<模块>
# 改代码 / 跑 npm run build / npm test / 自测
git add <只加自己的文件>
git commit -m "feat(<scope>): <一句话>"
git push -u origin HEAD
```

没有 collaborator 权限也可以：先 fork 仓库，从 `upstream/main` 开分支，推到自己的 fork，再向 `echo14670/changming-maze:main` 开 PR。详见 [提交与协作说明](docs/提交与协作说明.md)。

然后在 GitHub 向 `main` 开 PR，等 1 个 approve + `build` 通过后 squash merge。不要直接推 `main`，不要 force push 共享分支。
