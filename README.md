# 华炬 Skill 集市

山西华炬律师事务所的 AI 技能共享网站，含在线排版工具（文件只在浏览器本地处理）。

- 在线排版：`tools/paiban/`，排版引擎改编自 [document-format-skills](https://github.com/KaguraNanaga/document-format-skills)（MIT），参照样板排版与在线版由韩宇开发
- 运行环境：[Pyodide](https://pyodide.org) 0.27.2（MPL-2.0），随站点自托管

## 技能库（`hub/`）

技能目录、在线阅读 SKILL.md、上传审核、版本、评分收藏，功能参考 [iflytek/skillhub](https://github.com/iflytek/skillhub)（Apache-2.0）。仍是纯静态页面，登录、数据库、文件存储都用 Supabase。

| 页面 | 谁能用 |
|---|---|
| `hub/index.html` 技能库 | 所有人；“仅所内”技能卡片可见，内容和下载要登录 |
| `hub/skill.html?s=<标识>` 详情 | 同上；登录后可评分、收藏 |
| `hub/publish.html` 发布 | @huajulaw.com 邮箱登录后 |
| `hub/me.html` 我的 | 登录后：提交进度、撤回、收藏 |
| `hub/admin.html` 审核管理 | `hub_admins` 表里的管理员 |

### 上线步骤（只做一次）

1. Supabase → SQL Editor，依次运行 `supabase-hub.sql`、`supabase-hub-seed.sql`（导入现有 10 个技能）。
2. 同一处运行，把自己设成管理员：`insert into public.hub_admins(email) values ('你的邮箱@huajulaw.com');`
3. Authentication → Sign In / Providers → Email：保持开启。
4. Authentication → URL Configuration：Site URL 填 `https://skill.huajulaw.com`，Redirect URLs 加 `https://skill.huajulaw.com/**`。
5. Authentication → Emails：把 **Magic Link** 和 **Confirm signup** 两个模板都换成 `supabase-hub-email.html` 的内容（默认模板只有链接，没有验证码）。
6. 建议在 Authentication → Emails → SMTP Settings 配上所里的发信邮箱。Supabase 自带的发信服务每小时只能发几封，只适合测试。

换邮箱后缀：改 `js/config.js` 的 `HUB_EMAIL_DOMAIN`，同时 `update public.hub_settings set value = '新后缀' where key = 'email_domain';`。

第三方前端库随站点自托管，见 `js/vendor/README.md`。
