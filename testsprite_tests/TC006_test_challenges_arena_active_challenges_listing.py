import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def wait_for_server_ready(url, timeout=60):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=5)
            if r.status_code < 500:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    raise RuntimeError(f"Server at {url} not ready after {timeout} seconds")

def authenticate():
    # Since /auth/v1/authorize does not exist per PRD, return dummy token
    return "dummy-token"

def test_challenges_arena_active_challenges_listing():
    # Wait for server readiness (landing page root)
    wait_for_server_ready(f"{BASE_URL}/")

    # Authenticate and get bearer token
    token = authenticate()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    # Verify that /api requests return 401 without auth (middleware)
    unauth_resp = requests.get(f"{BASE_URL}/api/challenges", timeout=TIMEOUT)
    assert unauth_resp.status_code == 401, f"Expected 401 for unauthenticated /api request, got {unauth_resp.status_code}"

    # Access /chat page requires auth: simulate GET /chat returns 200
    chat_resp = requests.get(f"{BASE_URL}/chat", headers=headers, timeout=TIMEOUT)
    assert chat_resp.status_code == 200, f"Accessing /chat failed with status {chat_resp.status_code}"

    # From /chat, enter challenges room by GET /api/challenges
    challenges_resp = requests.get(f"{BASE_URL}/api/challenges", headers=headers, timeout=TIMEOUT)
    assert challenges_resp.status_code == 200, f"Fetching /api/challenges failed with status {challenges_resp.status_code}"
    challenges_list = challenges_resp.json()
    assert isinstance(challenges_list, list), "Challenges response is not a list"

    assert len(challenges_list) > 0, "No active challenges found"

    # Open one challenge to see details
    # Assuming each challenge has an 'id' and endpoint to get details is /api/challenges/{id}
    challenge_id = None
    for challenge in challenges_list:
        if "id" in challenge:
            challenge_id = challenge["id"]
            break
    assert challenge_id is not None, "No challenge with id found"

    challenge_detail_resp = requests.get(f"{BASE_URL}/api/challenges/{challenge_id}", headers=headers, timeout=TIMEOUT)
    assert challenge_detail_resp.status_code == 200, f"Fetching challenge detail failed with status {challenge_detail_resp.status_code}"
    challenge_detail = challenge_detail_resp.json()
    assert challenge_detail.get("id") == challenge_id, "Challenge detail id mismatch"
    # Check for some expected fields in challenge detail for validity
    assert "title" in challenge_detail or "name" in challenge_detail, "Challenge detail missing title/name"
    assert "description" in challenge_detail or "details" in challenge_detail, "Challenge detail missing description/details"

test_challenges_arena_active_challenges_listing()
