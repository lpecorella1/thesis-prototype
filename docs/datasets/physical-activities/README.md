# Physical Activities Dataset Source

Questa cartella conserva il documento sorgente usato come riferimento per il catalogo delle attivita fisiche di NutriTrack.

## Fonte

- Documento locale: `1_2024-adult-compendium_1_2024.pdf`
- Documento locale older adults: `2_2024-older-adult-compendium_1_2024.pdf`
- Fonte ufficiale: https://pacompendium.com/adult-compendium/
- Fonte ufficiale older adults: https://pacompendium.com/older-adult-compendium/
- Nota metodologica sui corrected METs: https://pacompendium.com/corrected-mets/
- Riferimento: Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities.

## Uso nel prototipo

Il frontend carica il dataset strutturato derivato dal PDF:

- CSV adulti usato dall'app: `frontend/data/physical-activities/adult-compendium-2024.csv`
- CSV older adults usato dall'app: `frontend/data/physical-activities/older-adult-compendium-2024.csv`
- Script di estrazione: `extract_adult_compendium_csv.py`

Quando l'eta del profilo e almeno 60 anni, NutriTrack usa il CSV older adults con valori `MET60+` e base di riposo `2.7 ml/kg/min`. Per eta inferiori usa il CSV adulti standard con base `3.5 ml/kg/min`.

Non esiste piu un catalogo locale hardcoded di attivita: i CSV derivati dai PDF sono l'unica sorgente dati usata dal box attivita fisica.

Per rigenerare il CSV:

```bash
python3 -m pip install --target /tmp/nutritrack-pdfdeps pypdf
PYTHONPATH=/tmp/nutritrack-pdfdeps python3 docs/datasets/physical-activities/extract_adult_compendium_csv.py --pdf docs/datasets/physical-activities/1_2024-adult-compendium_1_2024.pdf --output frontend/data/physical-activities/adult-compendium-2024.csv --population adult --met-basis standard_met --resting-vo2 3.5
PYTHONPATH=/tmp/nutritrack-pdfdeps python3 docs/datasets/physical-activities/extract_adult_compendium_csv.py --pdf docs/datasets/physical-activities/2_2024-older-adult-compendium_1_2024.pdf --output frontend/data/physical-activities/older-adult-compendium-2024.csv --population older_adult --met-basis met60_plus --resting-vo2 2.7
```

Questo produce CSV con `major_heading`, `activity_code`, `met_value`, `activity_description`, `source_page`, `source_document`, `population`, `met_basis` e `resting_vo2_ml_kg_min`.

Per un approccio RAG completo, questo CSV puo essere indicizzato con embedding o ricerca full-text, mantenendo il PDF come fonte primaria e usando `activity_code`/`source_page` per risalire alla voce originale.
