#!/usr/bin/env python3
"""Generate the checked-in, product-only restaurant catalogue asset.

The workbook is an OOXML zip file, so this script uses only Python's standard
library. It deliberately reads the ALL_PRODUCTS worksheet and never reads the
ALL_USERS worksheet, which contains credentials and is outside the catalogue
import scope.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
from zipfile import ZipFile
from xml.etree import ElementTree as ET


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": OFFICE_REL_NS, "p": PACKAGE_REL_NS}

PRODUCT_SHEET = "ALL_PRODUCTS"
EXCLUDED_SHEET = "ALL_USERS"
TITANIUM_SITE_ID = "a4e69a8b8344"
EXPECTED_HEADERS = {
    "id",
    "price",
    "category",
    "sub_category",
    "image_url",
    "description",
    "details",
    "site_id",
    "createdAt",
    "store_stock",
    "house_stock",
    "name",
    "float",
    "image",
    "picture",
}
PNG_DATA_URI_RE = re.compile(r"data:image/png;base64,[A-Za-z0-9+/=\s]+\Z")
CELL_REF_RE = re.compile(r"([A-Z]+)")


def column_index(cell_reference: str) -> int:
    match = CELL_REF_RE.match(cell_reference)
    if not match:
        raise ValueError(f"Invalid cell reference: {cell_reference!r}")

    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - 64
    return result - 1


def clean_text(value: object | None) -> str:
    if value is None:
        return ""

    text = unicodedata.normalize("NFC", str(value)).replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(
        char
        for char in text
        if char in "\n\t" or not unicodedata.category(char).startswith("C")
    )
    return text.strip()


SECRET_QUERY_KEYS = {"token", "access_token", "signature", "sig", "key", "apikey", "api_key"}


def strip_url_credentials(url: str) -> str:
    """Drop credential-bearing query params (Firebase Storage download tokens etc.).

    The catalogue is committed to a public repo, so a URL must never carry a
    bearer value. Images then rely on the bucket's own read rules.
    """
    if not url:
        return url

    parts = urlsplit(url)
    kept = [
        pair
        for pair in parts.query.split("&")
        if pair and pair.split("=", 1)[0].lower() not in SECRET_QUERY_KEYS
    ]
    return parts._replace(query="&".join(kept)).geturl()


def numeric(value: object | None, field: str, source_id: str, *, required: bool = False) -> int | float | None:
    if value is None or value == "":
        if required:
            raise ValueError(f"{field} is required for source product {source_id}")
        return None

    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric for source product {source_id}: {value!r}") from exc

    if not math.isfinite(result):
        raise ValueError(f"{field} must be finite for source product {source_id}")
    return int(result) if result.is_integer() else result


def load_shared_strings(archive: ZipFile) -> list[str]:
    path = "xl/sharedStrings.xml"
    if path not in archive.namelist():
        return []

    root = ET.fromstring(archive.read(path))
    return [
        "".join(node.text or "" for node in item.findall(".//m:t", NS))
        for item in root.findall("m:si", NS)
    ]


def worksheet_path(archive: ZipFile, sheet_name: str) -> tuple[str, list[str]]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall("p:Relationship", NS)
    }

    names: list[str] = []
    target: str | None = None
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        name = sheet.attrib["name"]
        names.append(name)
        if name == sheet_name:
            relationship_id = sheet.attrib[f"{{{OFFICE_REL_NS}}}id"]
            target = targets[relationship_id]

    if target is None:
        raise ValueError(f"Worksheet {sheet_name!r} was not found; available sheets: {names}")

    resolved = str(PurePosixPath("xl") / PurePosixPath(target.lstrip("/")))
    return resolved, names


def cell_value(cell: ET.Element, shared_strings: list[str]) -> object | None:
    if cell.find("m:f", NS) is not None:
        raise ValueError(f"Formula found in {PRODUCT_SHEET}!{cell.attrib.get('r', '?')}; formulas are not imported")

    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        inline = cell.find("m:is", NS)
        return "" if inline is None else "".join(node.text or "" for node in inline.findall(".//m:t", NS))

    value_node = cell.find("m:v", NS)
    raw = "" if value_node is None or value_node.text is None else value_node.text
    if cell_type in {"str", "e"}:
        return raw
    if cell_type == "s":
        return shared_strings[int(raw)]
    if cell_type == "b":
        return raw == "1"
    if raw == "":
        return None

    try:
        number = float(raw)
    except ValueError:
        return raw
    return int(number) if number.is_integer() else number


def product_rows(archive: ZipFile) -> tuple[list[dict[str, object | None]], list[str]]:
    path, sheet_names = worksheet_path(archive, PRODUCT_SHEET)
    shared_strings = load_shared_strings(archive)
    worksheet = ET.fromstring(archive.read(path))

    rows: list[list[object | None]] = []
    for row in worksheet.findall("m:sheetData/m:row", NS):
        values: dict[int, object | None] = {}
        for cell in row.findall("m:c", NS):
            values[column_index(cell.attrib["r"])] = cell_value(cell, shared_strings)
        width = max(values, default=-1) + 1
        rows.append([values.get(index) for index in range(width)])

    if not rows:
        raise ValueError(f"Worksheet {PRODUCT_SHEET!r} is empty")

    headers = [clean_text(value) for value in rows[0]]
    missing_headers = EXPECTED_HEADERS.difference(headers)
    if missing_headers:
        raise ValueError(f"Missing expected product headers: {sorted(missing_headers)}")

    products: list[dict[str, object | None]] = []
    for values in rows[1:]:
        padded = values + [None] * (len(headers) - len(values))
        products.append(dict(zip(headers, padded, strict=True)))
    return products, sheet_names


def sanitize_product(row: dict[str, object | None]) -> dict[str, object | None]:
    source_id = clean_text(row["id"])
    if not source_id:
        raise ValueError("Every selected product must have a source id")

    name = clean_text(row["name"])
    category = clean_text(row["category"])
    if not name or not category:
        raise ValueError(f"Product {source_id} must have a name and category")
    if "<" in name or ">" in name or "<" in category or ">" in category:
        raise ValueError(f"HTML-like markup is not allowed in product {source_id}")

    price = numeric(row["price"], "price", source_id, required=True)
    assert price is not None
    if price < 0:
        raise ValueError(f"price cannot be negative for source product {source_id}")

    image_url = clean_text(row["image_url"] or row["image"])
    if image_url and urlsplit(image_url).scheme != "https":
        raise ValueError(f"Only HTTPS product image URLs are allowed for source product {source_id}")
    image_url = strip_url_credentials(image_url)

    image_png = clean_text(row["picture"])
    invalid_image_png = False
    if image_png:
        if PNG_DATA_URI_RE.fullmatch(image_png):
            image_png = re.sub(r"\s+", "", image_png)
        else:
            # The supplied export contains one literal "...[TRUNCATED]" image
            # value. Keep that fact as validation metadata, but never publish a
            # malformed data URI; its valid HTTPS image_url remains available.
            invalid_image_png = True
            image_png = ""

    return {
        "category": category,
        "description": clean_text(row["description"]) or None,
        "details": clean_text(row["details"]) or None,
        "float": numeric(row["float"], "float", source_id),
        "house_stock": numeric(row["house_stock"], "house_stock", source_id) or 0,
        "image_png": image_png or None,
        "invalid_image_png": invalid_image_png,
        "image_url": image_url or None,
        "name": name,
        "price": price,
        "source_created_at": clean_text(row["createdAt"]) or None,
        "source_id": source_id,
        "source_site_id": clean_text(row["site_id"]),
        "store_stock": numeric(row["store_stock"], "store_stock", source_id) or 0,
        "sub_category": clean_text(row["sub_category"]) or None,
    }


def generate(workbook_path: Path) -> dict[str, object]:
    workbook_bytes = workbook_path.read_bytes()
    source_sha256 = hashlib.sha256(workbook_bytes).hexdigest().upper()

    with ZipFile(workbook_path) as archive:
        rows, sheet_names = product_rows(archive)

    if EXCLUDED_SHEET not in sheet_names:
        raise ValueError(f"Expected excluded worksheet {EXCLUDED_SHEET!r} was not found")

    selected = [row for row in rows if clean_text(row["site_id"]) == TITANIUM_SITE_ID]
    products = [sanitize_product(row) for row in selected]

    source_ids = [str(product["source_id"]) for product in products]
    duplicate_ids = [source_id for source_id, count in Counter(source_ids).items() if count > 1]
    if duplicate_ids:
        raise ValueError(f"Duplicate source product ids found: {duplicate_ids[:10]}")

    category_keys = {str(product["category"]).casefold() for product in products}
    normalized_names = Counter(str(product["name"]).casefold() for product in products)
    source_dates = [
        str(product["source_created_at"])
        for product in products
        if product["source_created_at"]
    ]

    metadata = {
        "active_product_count": sum(float(product["price"]) > 0 for product in products),
        "category_count": len(category_keys),
        "excluded_product_count": len(rows) - len(products),
        "excluded_sheets": [EXCLUDED_SHEET],
        "house_stock_total": sum(float(product["house_stock"]) for product in products),
        "image_png_count": sum(bool(product["image_png"]) for product in products),
        "image_url_count": sum(bool(product["image_url"]) for product in products),
        "invalid_image_png_count": sum(bool(product["invalid_image_png"]) for product in products),
        "negative_house_stock_count": sum(float(product["house_stock"]) < 0 for product in products),
        "normalized_duplicate_name_groups": sum(count > 1 for count in normalized_names.values()),
        "product_count": len(products),
        "sheet": PRODUCT_SHEET,
        "snapshot_at": max(source_dates) if source_dates else "2026-08-27T00:00:00.000Z",
        "source_filename": workbook_path.name,
        "source_product_count": len(rows),
        "source_sha256": source_sha256,
        "store_stock_total": sum(float(product["store_stock"]) for product in products),
        "titanium_site_id": TITANIUM_SITE_ID,
        "zero_price_product_count": sum(float(product["price"]) == 0 for product in products),
    }
    return {"metadata": metadata, "products": products}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path, help="Path to restaurant_export.xlsx")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/data/restaurant-products.json"),
        help="Generated product-only JSON path",
    )
    args = parser.parse_args()

    payload = generate(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    args.output.write_text(serialized, encoding="utf-8", newline="\n")

    metadata = payload["metadata"]
    print(
        f"Wrote {args.output} with {metadata['product_count']} Titanium products, "
        f"{metadata['category_count']} categories, and no {EXCLUDED_SHEET} data."
    )


if __name__ == "__main__":
    main()
