# 本地服务 HTTP 接口速查

基础地址：`http://127.0.0.1:8010`（服务默认只监听本机）

所有请求/响应用 JSON。失败时返回 4xx/5xx，体里 `detail` 字段是原因。

## GET /v1/status

服务与账号状态。发送前建议先探活。

```json
{
  "account": { "wxid": "wxid_xxx", "name": "昵称" },
  "paused": false,
  "version": "1.2.8.1"
}
```

## POST /v1/send_text

```json
{ "room_id": "12345678@chatroom", "text": "大家好", "reuse_chat": false }
```

- `room_id`：群聊 `xxx@chatroom`，私聊对方 `wxid`
- `reuse_chat`：复用已打开的会话窗口，后续发送更快（首次为 false 更稳）

## POST /v1/send_file

```json
{ "room_id": "12345678@chatroom", "path": "C:\\path\\to\\report.pdf" }
```

单个文件建议 < 1GB。

## POST /v1/send_sticker

发图片/表情（PNG/JPG/GIF）。

```json
{ "room_id": "12345678@chatroom", "path": "C:\\path\\to\\sticker.gif", "reuse_chat": false }
```

## GET /v1/groups

已知群列表（群 id + 群名），用于发送前确认 `room_id`。

## GET /v1/contacts

联系人列表。

## GET /v1/contacts/{wxid}/messages?limit=50

读取某个会话最近消息（部分版本支持）。

## GET /v1/events?since=<seq>&timeout=0.8

长轮询拉事件流（新消息、发送结果等），`since` 传上次返回的 seq。

## POST /v1/admin_contacts

```json
{ "wxids": ["wxid_xxx"] }
```

把若干 wxid 记为管理员（部分部署用于权限控制）。

## POST /v1/reattach

重新挂接客户端窗口（服务失联或窗口重开后调用）。

## 说明

- 上面是社区镜像常用的端点集合，随上游版本可能增删；以 `wechatauto-replica` 的实际实现为准
- 服务只面向本机，不要暴露到公网
- 调用方要做好错误处理：失败不要立刻重试轰炸，容易触发风控
