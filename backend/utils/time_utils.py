"""
Time and timestamp handling utilities for IoT telemetry.
"""

from datetime import datetime, timezone, timedelta
from typing import Union, Optional

IST = timezone(timedelta(hours=5, minutes=30))


def utc_now() -> datetime:
    """Return the current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def validate_clock_sanity(
    dt: datetime,
    max_future_sec: float = 600.0,
    max_past_sec: float = 86400.0
) -> bool:
    """
    Validates whether the incoming device timestamp is reasonable relative to server UTC.
    Rejects clocks > 10 min in the future, > 24h in the past, or with uninitialized RTC (< 2024).
    """
    if dt.year < 2024:
        return False
    now = utc_now()
    diff_sec = (now - dt).total_seconds()
    if diff_sec < -max_future_sec:  # More than 10 mins in the future
        return False
    if diff_sec > max_past_sec:     # More than 24 hours in the past
        return False
    return True


def _normalize_naive_datetime(dt: datetime) -> datetime:
    """
    Normalizes a naive datetime into timezone-aware UTC.
    Detects whether the device transmitted local Indian Standard Time (IST, UTC+05:30)
    without timezone offset by checking if interpreting it as UTC places it in the future
    while interpreting it as IST yields a sensible, sane timestamp.
    """
    now = utc_now()
    dt_utc = dt.replace(tzinfo=timezone.utc)
    diff_future = (dt_utc - now).total_seconds()

    # If the naive timestamp as UTC is > 5 minutes in the future (e.g. device RTC is on local IST)
    if diff_future > 300:
        dt_ist_to_utc = dt.replace(tzinfo=IST).astimezone(timezone.utc)
        if validate_clock_sanity(dt_ist_to_utc):
            return dt_ist_to_utc

    return dt_utc


def parse_timestamp(val: Union[str, int, float, datetime, None], reject_far_off: bool = True) -> datetime:
    """
    Parses incoming timestamp (epoch seconds/ms, ISO string, or naive/aware datetime)
    into a timezone-aware UTC datetime.
    Converts device local offsets to UTC, and rejects far-off clocks if reject_far_off=True.
    """
    if val is None:
        return utc_now()

    parsed: Optional[datetime] = None

    # Handle numeric epoch timestamp (seconds or milliseconds)
    if isinstance(val, (int, float)):
        try:
            ts = float(val)
            if ts > 1e11:  # Milliseconds
                ts = ts / 1000.0
            parsed = datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            parsed = None

    elif isinstance(val, datetime):
        if val.tzinfo is None:
            parsed = _normalize_naive_datetime(val)
        else:
            parsed = val.astimezone(timezone.utc)

    elif isinstance(val, str):
        raw_str = val.strip()
        if not raw_str:
            return utc_now()

        # Try ISO format (e.g. 2026-10-10T14:30:00Z or 2026-10-10T20:00:00+05:30)
        try:
            clean_str = raw_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_str)
            if dt.tzinfo is None:
                parsed = _normalize_naive_datetime(dt)
            else:
                parsed = dt.astimezone(timezone.utc)
        except Exception:
            pass

        # Try common firmware text formats
        if parsed is None:
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S.%f%z",
                "%d-%m-%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S"
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(raw_str, fmt)
                    if dt.tzinfo is None:
                        parsed = _normalize_naive_datetime(dt)
                    else:
                        parsed = dt.astimezone(timezone.utc)
                    break
                except ValueError:
                    continue

    if parsed is None:
        parsed = utc_now()

    # Reject far-off device clocks and fallback to current server UTC
    if reject_far_off and not validate_clock_sanity(parsed):
        return utc_now()

    return parsed


def elapsed_seconds(from_time: datetime, to_time: Optional[datetime] = None) -> float:
    """Calculate elapsed seconds between two datetimes (handles naive and timezone-aware)."""
    if to_time is None:
        to_time = utc_now()
    
    # Normalize tzinfo if one is naive and other is aware
    if from_time.tzinfo is None and to_time.tzinfo is not None:
        from_time = from_time.replace(tzinfo=to_time.tzinfo)
    elif from_time.tzinfo is not None and to_time.tzinfo is None:
        to_time = to_time.replace(tzinfo=from_time.tzinfo)
        
    return abs((to_time - from_time).total_seconds())
