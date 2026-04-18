import requests
from requests.exceptions import RequestException

BASE_URL = "http://localhost:3000"
ONBOARDING_ENDPOINT = "/api/onboarding"
TIMEOUT = 30


def test_onboarding_profile_setup_validation():
    # 1. Verify that POST /api/onboarding without auth returns 401
    url = BASE_URL + ONBOARDING_ENDPOINT

    payload = {
        "displayName": "Test User",
        "role": "Developer",
        "bio": "This is a test bio.",
        "profileImage": "http://example.com/image.png"
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to onboarding endpoint without auth failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"

    # 2. To test validation, perform login to get auth token (simulate login)
    # Since PRD uses Supabase Google OAuth and no token endpoint is defined here,
    # we can't perform actual login. So we simulate with a placeholder valid token.
    # If real token logic is available, it should be replaced here.
    # For testing purpose, assume a valid token string (replace with real token for real tests).
    valid_auth_token = "Bearer valid-auth-token"

    auth_headers = {
        "Content-Type": "application/json",
        "Authorization": valid_auth_token
    }

    # 3. Test missing displayName field
    invalid_payload_missing_displayName = {
        "role": "Developer",
        "bio": "Bio without display name",
        "profileImage": "http://example.com/image.png"
    }
    try:
        resp = requests.post(url, json=invalid_payload_missing_displayName, headers=auth_headers, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to onboarding endpoint with missing displayName failed: {e}"
    assert resp.status_code == 400 or resp.status_code == 422, (
        f"Expected 400 or 422 for missing displayName but got {resp.status_code}"
    )
    assert "displayName" in resp.text or "display name" in resp.text.lower(), \
        "Response should contain a validation error message about displayName"

    # 4. Test missing role field
    invalid_payload_missing_role = {
        "displayName": "Test User",
        "bio": "Bio without role",
        "profileImage": "http://example.com/image.png"
    }
    try:
        resp2 = requests.post(url, json=invalid_payload_missing_role, headers=auth_headers, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to onboarding endpoint with missing role failed: {e}"
    assert resp2.status_code == 400 or resp2.status_code == 422, (
        f"Expected 400 or 422 for missing role but got {resp2.status_code}"
    )
    assert "role" in resp2.text or "role" in resp2.text.lower(), \
        "Response should contain a validation error message about role"

    # 5. Test valid submission with all required fields
    valid_payload = {
        "displayName": "Test User",
        "role": "Developer",
        "bio": "Complete profile bio",
        "profileImage": "http://example.com/image.png"
    }
    try:
        resp3 = requests.post(url, json=valid_payload, headers=auth_headers, timeout=TIMEOUT)
    except RequestException as e:
        assert False, f"Request to onboarding endpoint with valid payload failed: {e}"
    assert resp3.status_code == 200 or resp3.status_code == 201, (
        f"Expected 200 or 201 for valid onboarding submission but got {resp3.status_code}"
    )
    json_resp = resp3.json()
    # Validate response has expected keys (e.g. profile info or redirect url or success message)
    assert isinstance(json_resp, dict), "Response JSON should be a dictionary"
    assert "displayName" in json_resp or "profile" in json_resp or "success" in json_resp, \
        "Response should indicate successful onboarding profile creation"


test_onboarding_profile_setup_validation()