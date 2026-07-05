"""Validate a PetPresence asset manifest and generated files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REQUIRED_ACTIONS = ("idle",)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pet-id", default="pet_demo", help="Pet id to validate.")
    parser.add_argument(
        "--required-action",
        action="append",
        dest="required_actions",
        help="Action that must exist. Can be passed more than once. Defaults to idle.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = REPO_ROOT / "data" / "pets" / args.pet_id / "action_assets.json"
    required_actions = tuple(args.required_actions or DEFAULT_REQUIRED_ACTIONS)

    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    errors: list[str] = []
    if manifest.get("pet_id") != args.pet_id:
        errors.append(f"manifest pet_id must be {args.pet_id}")

    assets = manifest.get("assets", {})
    for action in required_actions:
        spec = assets.get(action)
        if not spec:
            errors.append(f"missing action spec: {action}")
            continue

        media = REPO_ROOT / spec["path"]
        if not media.exists():
            errors.append(f"missing media for {action}: {media.relative_to(REPO_ROOT)}")

        sequence = spec.get("fallback_sequence")
        if sequence:
            frame_count = int(sequence.get("frame_count", 0))
            frame_pattern = sequence.get("path", "")
            frame_dir = (REPO_ROOT / frame_pattern).parent
            frames = sorted(frame_dir.glob("frame_*.png"))
            if len(frames) != frame_count:
                errors.append(
                    f"expected {frame_count} PNG frames for {action}, found {len(frames)} in {frame_dir.relative_to(REPO_ROOT)}"
                )

    if errors:
        print("Asset validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Asset validation passed for {args.pet_id}: {', '.join(required_actions)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
