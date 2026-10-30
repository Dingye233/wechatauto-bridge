# wechatauto bridge（DSH 插件 + HTTP 客户端）

把本地跑着的 **wechatauto 独立发送服务**（`http://127.0.0.1:8010`）包装成通用能力，给别的 agent 或 DeepSeek Harness（DSH）直接用。

- 适合谁：Windows 上已经装好并见过扫码登录的 wechatauto 服务、想让别的 agent 也能发消息/发文件的人
- 不包含什么：**不含** wechatauto 本体的源码（那是第三方 Apache-2.0 项目，见下方「上游」），这里只有桥接和文档

## 上游

本仓库依赖并仅调用本地服务，不修改、不再分发上游代码：

- 项目：<https://github.com/fanyuantaier/wechatauto-replica>
- PyPI 包：`wechatauto-replica`（Apache-2.0）
- 安装：`pip install wechatauto-replica`

## 里面有什么

```
dsh-plugin/     DSH 原生插件（暴露 5 个工具：状态、发文本、发文件、发图片、群列表）
client/         wechatauto_client.py，纯标准库的 Python 客户端
docs/API.md     本地服务 HTTP 接口速查（send_text / send_file / send_sticker / status ...）
scripts/        启动服务的示例脚本
```

## 一、先把本地服务跑起来

```powershell
pip install wechatauto-replica
# 首次需要扫码登录，登录后保持服务常驻（示例）
python -m wechatauto serve --port 8010
```

确认活着：

```powershell
curl http://127.0.0.1:8010/v1/status
```

## 二、DSH 里用（推荐）

把 `dsh-plugin/` 整个目录拷到你的 DSH `studio` 目录，例如
`<DSH_RUNTIME>/data/dsh/studio/wechatauto-bridge`，然后安装：

```bash
node --check lib/index.js
# 在群伴/DSH 控制台里安装该目录并启用
```

插件读两个环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `QUNBAN_WECHATAUTO_BASE` | `http://127.0.0.1:8010` | 本地服务地址 |
| `QUNBAN_DSH_RUNTIME_ROOT` | （必需） | DSH 运行时根目录，用来加载 `defineTool` |

暴露的工具：

| 工具 | 作用 |
| --- | --- |
| `wechatauto_status` | 账号是否在线、当前 wxid、服务版本 |
| `wechatauto_send_text` | 给群或联系人发文本（`room_id` 传群 id 或 wxid） |
| `wechatauto_send_file` | 发任意文件（<1GB） |
| `wechatauto_send_image` | 发图片/表情（走 sticker 通道） |
| `wechatauto_groups` | 列出已知群 |

> 注意：`room_id` 就是上游服务的会话 id。群聊传 `xxx@chatroom`，私聊传对方 wxid。

## 三、别的 agent 里用（HTTP / Python）

HTTP 直接调，见 [docs/API.md](docs/API.md)：

```bash
curl -X POST http://127.0.0.1:8010/v1/send_text \
  -H "content-type: application/json" \
  -d '{"room_id":"12345678@chatroom","text":"大家好"}'
```

Python：

```python
from wechatauto_client import Client

c = Client()                       # 默认 http://127.0.0.1:8010
print(c.status())
c.send_text("12345678@chatroom", "大家好")
c.send_file("12345678@chatroom", r"C:\path\to\report.pdf")
```

## 四、边界与风险

- 本仓库只做桥接，**不绕过登录**、不内置任何 cookie 或账号信息
- 服务本身通过 UI 自动化 + 数据库读取发消息，属于客户端自动化；请遵守微信使用条款，别用于群发骚扰
- 服务只监听 `127.0.0.1`，不要直接暴露到公网
- 发送失败时服务会返回 4xx/5xx，桥接层原样透出，不做重试轰炸

## License

本仓库代码 MIT（见 `LICENSE`）。上游 wechatauto-replica 为 Apache-2.0（见 `NOTICE`）。
