"""Seed Firebase Authentication with demo accounts.

Usage:
    python seed_auth_users.py [--reset-passwords]

This script uses the Firebase Admin SDK to ensure that the demo accounts used in
local development exist in Firebase Authentication with deterministic
passwords. If the user already exists, the script can optionally reset their
password and update their display name.
"""

from __future__ import annotations

import argparse
import base64
import importlib
import json
import os
from dataclasses import dataclass
from typing import Dict, List

try:
  auth = importlib.import_module("firebase_admin.auth")
  auth_utils = importlib.import_module("firebase_admin._auth_utils")
  ConfigurationNotFoundError = getattr(auth_utils, "ConfigurationNotFoundError")
  google_auth_requests = importlib.import_module("google.auth.transport.requests")
  AuthorizedSession = getattr(google_auth_requests, "AuthorizedSession")
  service_account_module = importlib.import_module("google.oauth2.service_account")
except ModuleNotFoundError as exc:  # pragma: no cover - handled at runtime
  raise SystemExit(
    "firebase_admin and google-auth packages are required. Install dependencies via 'pip install -r requirements.txt'."
  ) from exc

service_account = service_account_module

from firebase_client import FirebaseInitializationError, get_firebase_app


@dataclass(frozen=True)
class DemoUser:
  email: str
  password: str
  display_name: str
  role: str


DEMO_USERS: List[DemoUser] = [
  DemoUser(
    email="manager@bountyai.dev",
    password="manager123",
    display_name="Avery Holt",
    role="manager",
  ),
  DemoUser(
    email="developer@bountyai.dev",
    password="dev12345",
    display_name="Lena Park",
    role="developer",
  ),
]


def _load_service_account_credentials():
  base64_value = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64")
  credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

  if base64_value:
    try:
      decoded = base64.b64decode(base64_value).decode("utf-8")
      data = json.loads(decoded)
      return service_account.Credentials.from_service_account_info(data)
    except (ValueError, json.JSONDecodeError) as exc:  # pragma: no cover - configuration issue
      raise FirebaseInitializationError("Invalid FIREBASE_SERVICE_ACCOUNT_BASE64 value.") from exc

  if credential_path:
    expanded = os.path.expanduser(credential_path)
    if not os.path.exists(expanded):  # pragma: no cover - configuration issue
      raise FirebaseInitializationError(f"Service account file not found at {expanded}.")
    return service_account.Credentials.from_service_account_file(expanded)

  raise FirebaseInitializationError(
    "Missing Firebase service account credentials. Set FIREBASE_SERVICE_ACCOUNT_BASE64 or GOOGLE_APPLICATION_CREDENTIALS.",
  )


def ensure_email_password_provider_enabled(project_id: str) -> None:
  credentials = _load_service_account_credentials().with_scopes([
    "https://www.googleapis.com/auth/identitytoolkit",
  ])
  session = AuthorizedSession(credentials)
  base_url = f"https://identitytoolkit.googleapis.com/v1/projects/{project_id}/config"

  response = session.get(base_url)
  if response.status_code < 400:
    config = response.json()
    sign_in = config.get("signIn", {})
    email_config = sign_in.get("email", {})
    if email_config.get("enabled"):
      return
  elif response.status_code != 404:
    raise RuntimeError(
      f"Failed to fetch Identity Toolkit config (status {response.status_code}): {response.text}"
    )

  patch_payload = {"signIn": {"email": {"enabled": True}}}
  patch_params = {"updateMask": "signIn.email.enabled"}
  patch_response = session.patch(base_url, params=patch_params, json=patch_payload)
  if patch_response.status_code >= 400:
    if patch_response.status_code == 404:
      print(
        "Warning: Could not enable email/password provider via API (404). "
        "Assuming it was enabled manually in the Firebase Console."
      )
      return
    raise RuntimeError(
      f"Failed to enable email/password provider (status {patch_response.status_code}): {patch_response.text}"
    )
  print("Enabled Firebase Authentication email/password provider.")


def ensure_demo_user(user: DemoUser, *, reset_passwords: bool) -> None:
  try:
    new_user = auth.create_user(
      email=user.email,
      password=user.password,
      display_name=user.display_name,
      email_verified=True,
    )
    auth.set_custom_user_claims(new_user.uid, {"role": user.role})
    print(f"Created new demo user: {user.email}")
    return
  except auth.EmailAlreadyExistsError:
    pass
  except ConfigurationNotFoundError as error:
    raise SystemExit(
      "Email/password authentication is not enabled for this Firebase project. "
      "Enable it in the Firebase Console under Authentication → Sign-in method."
    ) from error

  # User already exists – sync critical fields
  try:
    record = auth.get_user_by_email(user.email)
  except ConfigurationNotFoundError as error:
    raise SystemExit(
      "Email/password authentication is not enabled for this Firebase project. "
      "Enable it in the Firebase Console under Authentication → Sign-in method."
    ) from error
  update_kwargs: Dict[str, object] = {}

  if record.display_name != user.display_name:
    update_kwargs["display_name"] = user.display_name

  if reset_passwords:
    update_kwargs["password"] = user.password

  if not record.email_verified:
    update_kwargs["email_verified"] = True

  if update_kwargs:
    auth.update_user(record.uid, **update_kwargs)
    print(f"Updated existing user: {user.email}")
  else:
    print(f"User already up to date: {user.email}")

  claims = {"role": user.role}
  if record.custom_claims != claims:
    auth.set_custom_user_claims(record.uid, claims)
    print(f"  ↳ Set custom claims for {user.email}: {claims}")


def seed_auth_users(reset_passwords: bool) -> None:
  # Ensure Firebase Admin is initialized before interacting with auth
  get_firebase_app()

  for user in DEMO_USERS:
    ensure_demo_user(user, reset_passwords=reset_passwords)


def main() -> None:
  parser = argparse.ArgumentParser(description="Ensure Firebase Auth demo users exist")
  parser.add_argument(
    "--reset-passwords",
    action="store_true",
    help="Reset passwords for existing demo users to match the defaults",
  )
  args = parser.parse_args()

  try:
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
      raise FirebaseInitializationError("FIREBASE_PROJECT_ID environment variable is required.")

    ensure_email_password_provider_enabled(project_id)
    seed_auth_users(reset_passwords=args.reset_passwords)
  except FirebaseInitializationError as exc:
    raise SystemExit(
      "Firebase Admin SDK is not configured. Ensure backend/.env contains valid credentials."
    ) from exc
  except RuntimeError as exc:
    raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
  main()
