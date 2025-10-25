"""Utility helpers for working with Firebase Admin and Firestore.

This module centralizes Firebase initialization for the FastAPI backend. It reads
credentials from environment variables so sensitive data never lives in source
control. Typical usage:

    from firebase_client import get_firestore_client

    db = get_firestore_client()
    doc = db.collection("teams").document("team-123").get()

The module supports three credential loading strategies, in priority order:
1. FIREBASE_SERVICE_ACCOUNT_BASE64: base64 encoded service account JSON string.
2. GOOGLE_APPLICATION_CREDENTIALS: path to a service account JSON file.
3. Default application credentials (e.g., Cloud Run / GCE metadata server).

If FIRESTORE_EMULATOR_HOST is set, the Firestore client will automatically
connect to the emulator instance instead of the live service.
"""

from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from typing import Dict, Optional

import firebase_admin
from firebase_admin import credentials, firestore

CredentialDict = Dict[str, object]


class FirebaseInitializationError(RuntimeError):
    """Raised when Firebase Admin cannot be initialized due to configuration."""


def _load_service_account() -> Optional[credentials.Certificate]:
    """Load Firebase credentials from supported environment variables."""
    raw_base64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
    if raw_base64:
        try:
            decoded = base64.b64decode(raw_base64).decode("utf-8")
            data: CredentialDict = json.loads(decoded)
            return credentials.Certificate(data)
        except (ValueError, json.JSONDecodeError) as exc:
            raise FirebaseInitializationError(
                "Invalid FIREBASE_SERVICE_ACCOUNT_BASE64 value."
            ) from exc

    credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credential_path:
        expanded_path = os.path.expanduser(credential_path)
        if not os.path.exists(expanded_path):
            raise FirebaseInitializationError(
                f"Service account file not found at {expanded_path}."
            )
        return credentials.Certificate(expanded_path)

    # Fallback to default credentials (e.g., when running on Cloud infrastructure)
    return None


def _build_options() -> Dict[str, object]:
    """Assemble optional initialization parameters for Firebase Admin."""
    options: Dict[str, object] = {}
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if project_id:
        options["projectId"] = project_id
    return options


@lru_cache(maxsize=1)
def get_firebase_app() -> firebase_admin.App:
    """Get or initialize a singleton Firebase App instance."""
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    cred = _load_service_account()
    options = _build_options()

    try:
        if cred is not None:
            return firebase_admin.initialize_app(cred, options or None)
        # When no explicit credentials are provided, fall back to default
        return firebase_admin.initialize_app(options=options or None)
    except Exception as exc:  # broad to capture firebase_admin errors
        raise FirebaseInitializationError(
            "Failed to initialize Firebase Admin SDK. Check credentials and configuration."
        ) from exc


@lru_cache(maxsize=1)
def get_firestore_client() -> firestore.Client:
    """Return a cached Firestore client bound to the configured Firebase App."""
    app = get_firebase_app()

    emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")
    if emulator_host:
        os.environ.setdefault("FIRESTORE_EMULATOR_HOST", emulator_host)

    return firestore.client(app=app)


__all__ = [
    "FirebaseInitializationError",
    "get_firebase_app",
    "get_firestore_client",
]
