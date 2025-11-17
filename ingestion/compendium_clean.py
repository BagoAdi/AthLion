import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
RAW = BASE_DIR / "compendium_raw.csv"
OUT = BASE_DIR / "compendium_clean.csv"


def main():
    # 1) CSV beolvasás Windows-os encodinggal
    df = pd.read_csv(
        RAW,
        encoding="latin1",   # ha nagyon szar lesz, próbáld "cp1250" vagy "cp1252"
        sep=None,
        engine="python",
    )

    # 2) Oszlopnevek normalizálása
    df.columns = [c.strip().lower() for c in df.columns]
    print("Oszlopok a raw CSV-ben:", df.columns.tolist())

    # 3) MET oszlop beazonosítása, de NEM dobunk el semmit
    met_col = None
    for cand in ["met", "mets", "met value", "met values"]:
        if cand in df.columns:
            met_col = cand
            break

    if met_col:
        # ha nincs "met" nevű oszlop, csináljunk egy alias-t
        if met_col != "met":
            df["met"] = df[met_col]
            print(f"MET oszlop forrása: '{met_col}' -> új 'met' oszlop")
        # numerikus konvert, de nem dobjuk el a sorokat, ha NaN lesz
        df["met"] = pd.to_numeric(df["met"], errors="coerce")

    # 4) Whitespace takarítás string mezőkben (minden oszlop marad)
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip()

    # 5) Mentés – MINDEN oszlop megy tovább
    df.to_csv(OUT, index=False)
    print(f"Mentve: {OUT}")
    print(df.head())


if __name__ == "__main__":
    main()
