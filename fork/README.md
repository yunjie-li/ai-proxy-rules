# Fork 自动同步与规则过滤

每天北京时间 07:17 同步 VPSDance/ai-proxy-rules 的 upstream/main 全部代码，
重新拉取规则来源，过滤异常项后再用上游生成器生成全部客户端规则。
GitHub Actions 可能延迟；可在 Actions → Generate Rules → Run workflow 手动运行。

同步使用上游完整文件树（包括删除的文件），仅保留 `fork/` 和
`.github/workflows/generate.yml`。其他目录的手工修改也会随每日同步被上游覆盖。
不强推分支；测试、规则数量骤减保护或推送冲突失败时，不发布本次更新。

`filter-rules.ts` 在 `pnpm sync` 之后、生成之前清洗 `data/providers`：

- 拒绝空域名、URL、路径、端口、通配符、控制字符和非法 DNS 标签，保留 IDN 与下划线标签。
- 校验 IP 地址族、网段前缀和 ASN 范围；不把域名校验套到正则或进程名上。
- 在日志记录被过滤项；清洗会导致整个 provider 为空时，停止发布。
- 继续运行上游 guard、类型、元数据、README 检查和全部测试。

所有 `rules/` 输出自动重新生成，无需维护快照。例如：
`https://raw.githubusercontent.com/yunjie-li/ai-proxy-rules/main/rules/stash/anthropic.list`。
`fork/last-sync.json` 记录最近一次通过检查的上游提交和时间。

节点不属于此规则仓库，原 Sub-Store 订阅仍使用 `target=ClashMeta&prettyYaml=true`。
