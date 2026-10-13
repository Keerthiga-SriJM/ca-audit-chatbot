"""
CA Audit Desk API - Python Client Example
Use this script to call the CA Audit API from Python, Flask, Django, FastAPI,
or data science pipelines.
"""

import requests
import json
from typing import Optional, List, Dict, Any

class CaAuditClient:
    def __init__(self, base_url: str = "http://localhost:3000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {"Accept": "application/json"}
        if self.api_key:
            self.headers["X-API-Key"] = self.api_key

    def _post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        headers = {**self.headers, "Content-Type": "application/json"}
        resp = requests.post(url, headers=headers, json=data)
        resp.raise_for_status()
        return resp.json()

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        resp = requests.get(url, headers=self.headers, params=params)
        resp.raise_for_status()
        return resp.json()

    def health(self) -> Dict[str, Any]:
        """Check API service status and latency"""
        return self._get("/api/health")

    def get_clients(self, stats: bool = True) -> List[Dict[str, Any]]:
        """List registered audit clients"""
        data = self._get("/api/clients", params={"stats": "true" if stats else "false"})
        return data.get("clients", [])

    def create_client(self, name: str, email: Optional[str] = None) -> Dict[str, Any]:
        """Register a new audit client"""
        return self._post("/api/clients", {"name": name, "email": email})

    def chat(self, message: str, client_name: Optional[str] = None, client_id: Optional[str] = None) -> Dict[str, Any]:
        """Ask a financial question or schedule a consultation"""
        payload = {"message": message}
        if client_id:
            payload["clientId"] = client_id
        elif client_name:
            payload["clientName"] = client_name
        return self._post("/api/chat", payload)

    def get_financials(self, client_name: Optional[str] = None, client_id: Optional[str] = None) -> Dict[str, Any]:
        """Get 10-year financials with totals and metrics"""
        params = {}
        if client_id:
            params["clientId"] = client_id
        elif client_name:
            params["clientName"] = client_name
        return self._get("/api/financials", params=params)

    def schedule_meeting(self, topic: str, start: str, duration_minutes: int = 30, attendees: Optional[List[str]] = None) -> Dict[str, Any]:
        """Schedule Google Meet consultation directly in Google Calendar"""
        return self._post("/api/calendar/sync", {
            "topic": topic,
            "start": start,
            "durationMinutes": duration_minutes,
            "attendees": attendees or []
        })

# --- Usage Example ---
if __name__ == "__main__":
    client = CaAuditClient(
        base_url="http://localhost:3000",
        api_key="ca_live_541c806cb70ae18dab3721e1e6740c5b"
    )
    
    print("1. Checking API Health:")
    try:
        health = client.health()
        print(f"Status: {health.get('status')} | Database: {health.get('services', {}).get('database')}")
    except Exception as e:
        print(f"Server check error: {e}")

    print("\n2. Querying Clients:")
    try:
        clients = client.get_clients()
        print(f"Found {len(clients)} clients:")
        for c in clients:
            print(f" - {c.get('name')} (ID: {c.get('id')})")
            
        if clients:
            first_client = clients[0]["name"]
            print(f"\n3. Chatting with CA Audit Bot for '{first_client}':")
            chat_res = client.chat("What was the highest profit year in the 10-year records?", client_name=first_client)
            print(f"Reply:\n{chat_res.get('reply')}")
    except Exception as e:
        print(f"Error during interaction: {e}")
