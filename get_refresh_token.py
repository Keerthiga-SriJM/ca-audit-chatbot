import json
import os
import re
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
]

CRED_FILE = "credentials.json"
ENV_FILE = ".env"

if not os.path.exists(CRED_FILE):
    print(f"Error: {CRED_FILE} not found. Please place your Google Cloud OAuth credentials file in the project root.")
    exit(1)

with open(CRED_FILE, "r") as f:
    cred_data = json.load(f)

installed = cred_data.get("installed") or cred_data.get("web")
if not installed:
    print("Invalid credentials.json format. Expected 'installed' or 'web' root key.")
    exit(1)

client_id = installed.get("client_id")
client_secret = installed.get("client_secret")

print("\n" + "=" * 65, flush=True)
print("  GOOGLE CALENDAR OAUTH2 AUTHORIZATION", flush=True)
print("=" * 65, flush=True)
print(f"Client ID: {client_id}", flush=True)
print("Starting local authorization server and opening browser...", flush=True)
print("Please sign in with your Google account and grant calendar permissions.\n", flush=True)

flow = InstalledAppFlow.from_client_secrets_file(CRED_FILE, SCOPES)
credentials = flow.run_local_server(
    port=0,
    access_type="offline",
    prompt="consent"
)

refresh_token = credentials.refresh_token

if not refresh_token:
    print("\n[!] Warning: No refresh token returned.")
    print("Google only returns a refresh token on first consent.")
    print("If you have approved before, revoke access at https://myaccount.google.com/permissions and run again.")
else:
    print("\n" + "=" * 65)
    print("  GOOGLE AUTHORIZATION SUCCESSFUL!")
    print("=" * 65)
    print(f"Refresh Token: {refresh_token[:15]}... (Length: {len(refresh_token)})")

    # Automatically synchronize .env
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            env_content = f.read()

        def set_or_replace_env(content: str, key: str, value: str) -> str:
            pattern = rf"^{re.escape(key)}=.*$"
            if re.search(pattern, content, flags=re.MULTILINE):
                return re.sub(pattern, f"{key}={value}", content, flags=re.MULTILINE)
            return content.rstrip() + f"\n{key}={value}\n"

        env_content = set_or_replace_env(env_content, "GOOGLE_CLIENT_ID", client_id)
        env_content = set_or_replace_env(env_content, "GOOGLE_CLIENT_SECRET", client_secret)
        env_content = set_or_replace_env(env_content, "GOOGLE_REFRESH_TOKEN", refresh_token)

        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.write(env_content)

        print(f"\n[OK] Automatically updated {ENV_FILE} with:")
        print(f"     GOOGLE_CLIENT_ID={client_id}")
        print(f"     GOOGLE_CLIENT_SECRET=***")
        print(f"     GOOGLE_REFRESH_TOKEN={refresh_token[:15]}...")
    else:
        print(f"\n[!] Note: {ENV_FILE} not found. Set GOOGLE_REFRESH_TOKEN={refresh_token}")