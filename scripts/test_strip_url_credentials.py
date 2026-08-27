"""Run with: python scripts/test_strip_url_credentials.py"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "gen", Path(__file__).with_name("generate_restaurant_catalogue.py")
)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)
strip = gen.strip_url_credentials

base = "https://firebasestorage.googleapis.com/v0/b/x/o/p%2Fa.jpeg"

assert strip(f"{base}?alt=media&token=f451d00d-15d5-4050-8344-843971f032fc") == f"{base}?alt=media"
assert strip(f"{base}?token=abc") == base
assert strip(f"{base}?alt=media") == f"{base}?alt=media"
assert strip(f"{base}?TOKEN=abc&alt=media") == f"{base}?alt=media"
assert strip(f"{base}?alt=media&signature=abc&api_key=xyz") == f"{base}?alt=media"
assert strip(f"{base}?tokenizer=keep") == f"{base}?tokenizer=keep"
assert strip("") == ""

catalogue = Path(__file__).resolve().parents[1] / "src/data/restaurant-products.json"
if catalogue.exists():
    assert "token=" not in catalogue.read_text(encoding="utf-8"), "catalogue still carries tokens"

print("ok")
