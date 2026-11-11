"""Shared test doubles for server.py unit tests (no real sockets)."""
from __future__ import annotations

import asyncio
import pathlib
import sys
from typing import Any, Dict, List, Optional

ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server as wf  # noqa: E402


class FakeWS:
    """Stands in for WebSocketConnection: messages in via a queue, JSON out into a list."""

    def __init__(self, name: str = "") -> None:
        self.name = name
        self.closed = False
        self.sent: List[Dict[str, Any]] = []
        self._inbox: "asyncio.Queue[Optional[str]]" = asyncio.Queue()

    async def send_json(self, data: Dict[str, Any]) -> None:
        if not self.closed:
            self.sent.append(data)

    async def recv_message(self) -> Optional[str]:
        msg = await self._inbox.get()
        if msg is None:
            self.closed = True
        return msg

    def push(self, raw: Optional[str]) -> None:
        self._inbox.put_nowait(raw)

    def of_type(self, t: str) -> List[Dict[str, Any]]:
        return [m for m in self.sent if m.get("t") == t]

    def last(self, t: str) -> Dict[str, Any]:
        found = self.of_type(t)
        if not found:
            raise AssertionError(f"{self.name}: no '{t}' message; got {[m.get('t') for m in self.sent]}")
        return found[-1]


class HubDriver:
    """Runs OnlineCupHub.handle() for several fake clients inside one event loop."""

    def __init__(self, grace_seconds: float = 0.2) -> None:
        self.hub = wf.OnlineCupHub(grace_seconds=grace_seconds)
        self.clients: Dict[str, FakeWS] = {}
        self.tasks: Dict[str, "asyncio.Task[None]"] = {}
        self.errors: Dict[str, BaseException] = {}

    def connect(self, name: str) -> FakeWS:
        ws = FakeWS(name)
        self.clients[name] = ws

        async def run() -> None:
            try:
                await self.hub.handle(ws)  # type: ignore[arg-type]
            except BaseException as exc:  # record crashes so tests can assert on them
                self.errors[name] = exc
                ws.closed = True

        self.tasks[name] = asyncio.create_task(run())
        return ws

    async def send(self, name: str, msg: Any, settle: float = 0.0) -> None:
        import json

        self.clients[name].push(msg if isinstance(msg, str) else json.dumps(msg))
        await self.settle(settle)

    async def disconnect(self, name: str) -> None:
        self.clients[name].push(None)
        await self.settle()

    @staticmethod
    async def settle(extra: float = 0.0) -> None:
        for _ in range(20):
            await asyncio.sleep(0)
        if extra:
            await asyncio.sleep(extra)

    async def close_all(self) -> None:
        for name, ws in self.clients.items():
            if not ws.closed:
                ws.push(None)
        await self.settle()
        for t in self.tasks.values():
            if not t.done():
                t.cancel()

    def room(self) -> "wf.OnlineRoom":
        assert len(self.hub.rooms) == 1, f"expected 1 room, have {list(self.hub.rooms)}"
        return next(iter(self.hub.rooms.values()))
