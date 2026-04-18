import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def get_auth_token():
    """
    Helper function to perform onboarding and get an auth token.
    The onboarding endpoint is /api/onboarding (POST).
    We'll create a basic profile to obtain auth cookies or token.
    For this test, let's assume the onboarding endpoint returns a token in JSON response.
    """
    onboarding_url = f"{BASE_URL}/api/onboarding"
    payload = {
        "displayName": "TestUser",
        "role": "Tester",
        "bio": "Test bio for status update viewing",
        "profileImage": "https://example.com/profile-image.png"
    }
    headers = {
        "Content-Type": "application/json"
    }
    resp = requests.post(onboarding_url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    # Expecting token in JSON response under 'token'
    token = resp.json().get("token")
    if not token:
        raise ValueError("Auth token not returned from onboarding.")
    return token


def wait_for_server_ready():
    """
    Poll the / endpoint until server is ready or timeout after 60 seconds.
    """
    url = f"{BASE_URL}/"
    for _ in range(60):
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(1)
    raise RuntimeError("Server not ready after waiting 60 seconds.")


def test_status_updates_viewing():
    wait_for_server_ready()

    token = get_auth_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    # Step 1: GET list of statuses
    statuses_url = f"{BASE_URL}/api/statuses"
    resp = requests.get(statuses_url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200 OK from /api/statuses, got {resp.status_code}"
    statuses = resp.json()
    assert isinstance(statuses, list), "Statuses endpoint should return a list"
    assert len(statuses) > 0, "Statuses list should not be empty"

    # Step 2: Pick one status to view full content and author details
    status = statuses[0]
    # Based on typical API, assume each status has an 'id' field
    status_id = status.get("id")
    assert status_id is not None, "Status item missing 'id' field"

    status_detail_url = f"{BASE_URL}/api/statuses/{status_id}"
    resp_detail = requests.get(status_detail_url, headers=headers, timeout=TIMEOUT)
    assert resp_detail.status_code == 200, f"Expected 200 OK from /api/statuses/{status_id}, got {resp_detail.status_code}"
    status_detail = resp_detail.json()

    # Validate full content and author details presence
    assert "content" in status_detail and isinstance(status_detail["content"], str) and len(status_detail["content"]) > 0, \
        "Status detail missing valid 'content'"
    assert "author" in status_detail and isinstance(status_detail["author"], dict), \
        "Status detail missing 'author' object"
    author = status_detail["author"]
    assert "id" in author and isinstance(author["id"], (int, str)), "Author missing 'id'"
    assert "displayName" in author and isinstance(author["displayName"], str) and len(author["displayName"]) > 0, \
        "Author missing valid 'displayName'"


test_status_updates_viewing()