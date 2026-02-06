#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def read_stdin() -> str:
    return sys.stdin.read()


def main() -> int:
    parser = argparse.ArgumentParser(description="Post a new SHYNOTE note via API key.")
    parser.add_argument("--title", required=True, help="Note title")
    parser.add_argument("--content", help="Markdown content (if omitted, stdin is used)")
    parser.add_argument(
        "--base-url",
        default=os.getenv("SHYNOTE_BASE_URL", "http://localhost:8000"),
        help="API base URL (default: env SHYNOTE_BASE_URL or http://localhost:8000)",
    )
    args = parser.parse_args()

    api_key = os.getenv("SHYNOTE_API_KEY")
    if not api_key:
        print("SHYNOTE_API_KEY is not set.", file=sys.stderr)
        return 1

    content = args.content if args.content is not None else read_stdin()
    payload = {"title": args.title, "content": content}
    body = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        f"{args.base_url}/api/new",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            resp_body = response.read().decode("utf-8")
            print(resp_body)
            return 0
    except urllib.error.HTTPError as e:
        print(f"Request failed: {e.code} {e.reason}", file=sys.stderr)
        print(e.read().decode("utf-8"), file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
