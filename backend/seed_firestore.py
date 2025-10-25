"""Utility script to load local JSON fixtures into Firestore.

Usage:
    python seed_firestore.py --tenant default

Available options:
    --data-dir: Override path to data directory (default: ./data)
    --reset:    Delete existing documents in each collection before inserting

The script reads teams.json and projects.json and writes them to:
    tenants/{tenant}/teams
    tenants/{tenant}/projects

Assignments can then be created through the API which will automatically
append to the "assignments" sub-collection.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Sequence

from firebase_client import FirebaseInitializationError, get_firestore_client

TENANT_FILENAME = "tenant.json"

COLLECTION_DATASETS = {
    "teams": "teams.json",
    "projects": "projects.json",
    "developers": "developers.json",
    "managers": "managers.json",
}

ASSIGNMENTS_FILENAME = "assignments.json"


def load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Seed file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _delete_collection(collection_ref) -> None:
    for doc in list(collection_ref.stream()):
        doc.reference.delete()


def _seed_primary_collection(
    tenant: str,
    collection: str,
    payload: Sequence[Dict],
    reset: bool = False,
) -> None:
    db = get_firestore_client()
    tenant_ref = db.collection("tenants").document(tenant)
    collection_ref = tenant_ref.collection(collection)

    if reset:
        _delete_collection(collection_ref)

    batch = db.batch()
    for entry in payload:
        doc_id = entry.get("id") or collection_ref.document().id
        cleansed = {**entry}
        batch.set(collection_ref.document(doc_id), cleansed)

    batch.commit()


def seed_tenant_document(tenant: str, payload: Dict) -> None:
    db = get_firestore_client()
    tenant_id = payload.get("id") or tenant
    doc_data = {k: v for k, v in payload.items() if k != "id"}
    db.collection("tenants").document(tenant_id).set(doc_data, merge=True)


def seed_assignments(
    tenant: str,
    assignments: Sequence[Dict],
    reset: bool = False,
) -> None:
    if not assignments:
        return

    db = get_firestore_client()
    tenant_ref = db.collection("tenants").document(tenant)
    projects_ref = tenant_ref.collection("projects")

    if reset:
        for project_doc in projects_ref.stream():
            _delete_collection(project_doc.reference.collection("assignments"))

    batch = db.batch()
    for entry in assignments:
        project_id = entry.get("projectId")
        if not project_id:
            raise ValueError("Assignment entry missing projectId")

        payload = {**entry, "tenantId": entry.get("tenantId") or tenant}
        assignment_id = entry.get("id") or projects_ref.document(project_id).collection("assignments").document().id
        batch.set(
            projects_ref.document(project_id).collection("assignments").document(assignment_id),
            payload,
        )

    batch.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Firestore with local fixtures")
    parser.add_argument("--tenant", default=os.getenv("FIREBASE_DEFAULT_TENANT_ID", "default"))
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    try:
        tenant_path = data_dir / TENANT_FILENAME
        if tenant_path.exists():
            tenant_payload = load_json(tenant_path)
            if isinstance(tenant_payload, list):
                raise ValueError("tenant.json must be a single JSON object, not an array")
            if not isinstance(tenant_payload, dict):
                raise ValueError("tenant.json must be a JSON object")
            seed_tenant_document(args.tenant, tenant_payload)

        for collection, filename in COLLECTION_DATASETS.items():
            dataset_path = data_dir / filename
            if not dataset_path.exists():
                continue
            items = load_json(dataset_path)
            if not isinstance(items, list):
                raise ValueError(f"{filename} must contain an array of objects")
            _seed_primary_collection(args.tenant, collection, items, reset=args.reset)

        assignments_path = data_dir / ASSIGNMENTS_FILENAME
        if assignments_path.exists():
            assignments = load_json(assignments_path)
            if not isinstance(assignments, list):
                raise ValueError("assignments.json must contain an array of objects")
            seed_assignments(args.tenant, assignments, reset=args.reset)

        print(
            "Seeded tenant document, collections "
            f"{', '.join(COLLECTION_DATASETS.keys())}"
            f"{' and assignments' if assignments_path.exists() else ''}"
            f" for tenant '{args.tenant}'."
        )
    except FirebaseInitializationError as exc:
        raise SystemExit(
            "Firebase Admin SDK is not configured. Ensure backend/.env is populated with credentials."
        ) from exc


if __name__ == "__main__":
    main()
