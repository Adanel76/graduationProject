import csv
import os
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import auth, schemas
from ..database import get_db

router = APIRouter(prefix="/data-control", tags=["data-control"])

BASE_DIR = Path(__file__).resolve().parents[2]
CSV_DIR = Path(os.environ.get("CSV_STORAGE_DIR", BASE_DIR / "storage" / "csv_datasets"))
INDEX_PATH = CSV_DIR / "index.json"
MAX_PREVIEW_ROWS = 20


def ensure_storage() -> None:
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_PATH.exists():
        INDEX_PATH.write_text("[]", encoding="utf-8")


def load_index() -> List[dict]:
    ensure_storage()
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_index(items: List[dict]) -> None:
    ensure_storage()
    INDEX_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def sanitize_filename(filename: str) -> str:
    base = Path(filename or "dataset.csv").name
    base = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", base, flags=re.UNICODE)
    return base or "dataset.csv"


def require_csv_manager(token: str, db: Session):
    current_user = auth.get_current_user_from_token(token, db)
    if current_user.role not in ["admin", "analyst"]:
        raise HTTPException(status_code=403, detail="CSV-раздел доступен только администратору и аналитику")
    return current_user


def read_csv_summary(path: Path) -> tuple[list[str], list[dict], int, list[str]]:
    issues: list[str] = []
    sample_rows: list[dict] = []
    rows_count = 0

    try:
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            columns = list(reader.fieldnames or [])
            if not columns:
                issues.append("Файл не содержит заголовков столбцов")
                return [], [], 0, issues

            empty_columns = [column for column in columns if not str(column or "").strip()]
            if empty_columns:
                issues.append("В файле есть пустые названия столбцов")

            for row in reader:
                rows_count += 1
                normalized = {column: (value or "") for column, value in row.items()}
                if len(sample_rows) < MAX_PREVIEW_ROWS:
                    sample_rows.append(normalized)

            if rows_count == 0:
                issues.append("Файл не содержит строк данных")

            return columns, sample_rows, rows_count, issues
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV должен быть сохранён в кодировке UTF-8")
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail=f"Ошибка чтения CSV: {exc}")


def meta_to_schema(meta: dict) -> schemas.CsvDatasetMeta:
    return schemas.CsvDatasetMeta(**meta)


@router.get("/csv", response_model=list[schemas.CsvDatasetMeta])
def list_csv_datasets(
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    require_csv_manager(token, db)
    items = sorted(load_index(), key=lambda item: item.get("created_at", ""), reverse=True)
    return [meta_to_schema(item) for item in items]


@router.post("/csv", response_model=schemas.CsvUploadResponse)
async def upload_csv_dataset(
    dataset_type: str = "dataset",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    current_user = require_csv_manager(token, db)

    original_name = sanitize_filename(file.filename or "dataset.csv")
    if not original_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Можно загрузить только файл CSV")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="CSV-файл пустой")

    ensure_storage()
    file_id = uuid.uuid4().hex
    stored_filename = f"{file_id}_{original_name}"
    path = CSV_DIR / stored_filename
    path.write_bytes(content)

    columns, sample_rows, rows_count, issues = read_csv_summary(path)
    uploaded_by_name = " ".join(filter(None, [current_user.first_name, current_user.last_name])) or current_user.email
    meta = {
        "id": file_id,
        "filename": stored_filename,
        "original_filename": original_name,
        "dataset_type": dataset_type or "dataset",
        "uploaded_by_user_id": current_user.id,
        "uploaded_by_name": uploaded_by_name,
        "size_bytes": len(content),
        "rows_count": rows_count,
        "columns_count": len(columns),
        "columns": columns,
        "created_at": datetime.utcnow().isoformat(),
        "issues": issues,
    }

    items = load_index()
    items.append(meta)
    save_index(items)

    return schemas.CsvUploadResponse(meta=meta_to_schema(meta), sample_rows=sample_rows)


@router.get("/csv/{dataset_id}/preview", response_model=schemas.CsvPreviewResponse)
def preview_csv_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    require_csv_manager(token, db)
    meta = next((item for item in load_index() if item.get("id") == dataset_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="CSV-набор не найден")

    path = CSV_DIR / meta["filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Файл CSV отсутствует на сервере")

    _, sample_rows, _, issues = read_csv_summary(path)
    if issues and issues != meta.get("issues"):
        meta["issues"] = issues
    return schemas.CsvPreviewResponse(meta=meta_to_schema(meta), sample_rows=sample_rows)


@router.get("/csv/{dataset_id}/download")
def download_csv_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    require_csv_manager(token, db)
    meta = next((item for item in load_index() if item.get("id") == dataset_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="CSV-набор не найден")

    path = CSV_DIR / meta["filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Файл CSV отсутствует на сервере")

    return FileResponse(path, media_type="text/csv", filename=meta.get("original_filename") or "dataset.csv")


@router.delete("/csv/{dataset_id}")
def delete_csv_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    token: str = Depends(auth.oauth2_scheme),
):
    require_csv_manager(token, db)
    items = load_index()
    meta = next((item for item in items if item.get("id") == dataset_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="CSV-набор не найден")

    path = CSV_DIR / meta["filename"]
    if path.exists():
        path.unlink()

    save_index([item for item in items if item.get("id") != dataset_id])
    return {"message": "CSV-набор удалён"}
