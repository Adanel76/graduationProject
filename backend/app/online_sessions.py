from datetime import datetime, timedelta
from typing import Dict, Optional

# In-memory registry of browser sessions that recently sent heartbeat.
# It intentionally does not use users.last_seen_at, because seeded/demo users or old logins
# can make the online counter look higher than the real number of open sessions.
_ACTIVE_SESSIONS: Dict[str, dict] = {}


def _now() -> datetime:
    return datetime.utcnow()


def _normalize_session_id(user_id: int, session_id: Optional[str]) -> str:
    cleaned = str(session_id or '').strip()
    if cleaned:
        return cleaned[:128]
    return f'user-{user_id}'


def record_online_session(user_id: int, session_id: Optional[str] = None) -> None:
    sid = _normalize_session_id(user_id, session_id)
    _ACTIVE_SESSIONS[sid] = {
        'user_id': int(user_id),
        'last_seen_at': _now(),
    }


def count_online_users(window_seconds: int = 90) -> int:
    window_seconds = max(15, min(int(window_seconds or 90), 600))
    threshold = _now() - timedelta(seconds=window_seconds)

    stale_session_ids = [
        session_id
        for session_id, payload in _ACTIVE_SESSIONS.items()
        if payload.get('last_seen_at') is None or payload.get('last_seen_at') < threshold
    ]
    for session_id in stale_session_ids:
        _ACTIVE_SESSIONS.pop(session_id, None)

    # Count unique users, not tabs. If the same person opens two tabs, it is still one user online.
    return len({payload['user_id'] for payload in _ACTIVE_SESSIONS.values()})
