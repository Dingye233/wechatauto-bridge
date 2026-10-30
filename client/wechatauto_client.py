# -*- coding: utf-8 -*-
"""wechatauto 本地服务的最小客户端（只用标准库，方便被别的 agent 直接 copy）。"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class Client:
    def __init__(self, base: str = "http://127.0.0.1:8010", timeout: float = 60.0) -> None:
        self.base = base.rstrip("/")
        self.timeout = timeout

    # ---------------- 内部
    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8", "replace")
                return json.loads(body) if body else {"ok": True}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail[:400]}") from exc

    # ---------------- 查询
    def status(self) -> dict[str, Any]:
        return self._request("GET", "/v1/status")

    def groups(self) -> dict[str, Any]:
        return self._request("GET", "/v1/groups")

    def contacts(self) -> dict[str, Any]:
        return self._request("GET", "/v1/contacts")

    # ---------------- 发送
    def send_text(self, room_id: str, text: str, reuse_chat: bool = False) -> dict[str, Any]:
        return self._request("POST", "/v1/send_text",
                             {"room_id": room_id, "text": text, "reuse_chat": reuse_chat})

    def send_file(self, room_id: str, path: str) -> dict[str, Any]:
        return self._request("POST", "/v1/send_file", {"room_id": room_id, "path": path})

    def send_image(self, room_id: str, path: str) -> dict[str, Any]:
        return self._request("POST", "/v1/send_sticker", {"room_id": room_id, "path": path})


if __name__ == "__main__":
    import sys

    client = Client()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        print(json.dumps(client.status(), ensure_ascii=False, indent=2)[:2000])
    elif cmd == "send" and len(sys.argv) > 3:
        print(client.send_text(sys.argv[2], " ".join(sys.argv[3:])))
    elif cmd == "file" and len(sys.argv) > 3:
        print(client.send_file(sys.argv[2], sys.argv[3]))
    else:
        print("usage: python wechatauto_client.py status | send <room_id> <text> | file <room_id> <path>")
