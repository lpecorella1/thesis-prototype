#!/usr/bin/env python3
"""Extract a clean CSV from the 2024 Adult Compendium PDF."""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - dependency guard for local tooling
    raise SystemExit(
        "Missing dependency: install pypdf first, e.g. "
        "`python3 -m pip install --target /tmp/nutritrack-pdfdeps pypdf` and run with "
        "`PYTHONPATH=/tmp/nutritrack-pdfdeps`."
    ) from exc


HEADER_LINE = "Major Heading Activity Code MET Value Activity Description"
IGNORED_LINES = {
    HEADER_LINE,
    "Major Heading Older Adult Code",
    "MET60",
    "(2.7 ml/kg/min) Activity Description",
    "2024 Adult Compendium of Physical Activities",
}
ROW_RE = re.compile(r"^(?P<major_heading>.+?)\s+(?P<activity_code>\d{5,7})\s+(?P<met_value>\d+(?:\.\d+)?)\s+(?P<activity_description>.+)$")


def normalize_line(value: str) -> str:
    return " ".join(value.strip().split())


def extract_rows(pdf_path: Path, population: str, met_basis: str, resting_vo2: str) -> list[dict[str, str]]:
    reader = PdfReader(str(pdf_path))
    rows: list[dict[str, str]] = []

    for page_index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        for raw_line in text.splitlines():
            line = normalize_line(raw_line)

            if not line or line in IGNORED_LINES:
                continue

            match = ROW_RE.match(line)

            if match:
                row = match.groupdict()
                row["source_page"] = str(page_index)
                row["source_document"] = pdf_path.name
                row["population"] = population
                row["met_basis"] = met_basis
                row["resting_vo2_ml_kg_min"] = resting_vo2
                rows.append(row)
                continue

            if rows:
                rows[-1]["activity_description"] = normalize_line(f"{rows[-1]['activity_description']} {line}")

    return rows


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "major_heading",
        "activity_code",
        "met_value",
        "activity_description",
        "source_page",
        "source_document",
        "population",
        "met_basis",
        "resting_vo2_ml_kg_min",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    default_pdf = Path(__file__).with_name("1_2024-adult-compendium_1_2024.pdf")
    default_output = Path(__file__).parents[3] / "frontend" / "data" / "physical-activities" / "adult-compendium-2024.csv"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=default_pdf, help="Path to the Adult Compendium PDF.")
    parser.add_argument("--output", type=Path, default=default_output, help="Path for the generated CSV.")
    parser.add_argument("--population", default="adult", help="Population label stored in the generated CSV.")
    parser.add_argument("--met-basis", default="standard_met", help="MET basis label stored in the generated CSV.")
    parser.add_argument("--resting-vo2", default="3.5", help="Resting VO2 value used by this MET basis.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = extract_rows(args.pdf, args.population, args.met_basis, args.resting_vo2)

    if not rows:
        raise SystemExit(f"No activity rows extracted from {args.pdf}")

    write_csv(rows, args.output)
    print(f"Extracted {len(rows)} activities to {args.output}")


if __name__ == "__main__":
    main()
