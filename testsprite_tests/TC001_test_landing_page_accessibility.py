import requests
from time import sleep

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def wait_for_server_ready(url, timeout=TIMEOUT, interval=1):
    elapsed = 0
    while elapsed < timeout:
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                return
        except requests.RequestException:
            pass
        sleep(interval)
        elapsed += interval
    raise RuntimeError(f"Server at {url} not ready after {timeout} seconds")

def test_landing_page_accessibility():
    wait_for_server_ready(BASE_URL)

    try:
        response = requests.get(BASE_URL + "/", timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to landing page failed: {e}"

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    content = response.text

    # Check presence of hero section by searching for id="hero" 
    assert 'id="hero"' in content, "Hero section with id='hero' not found on landing page"

    # Check features overview presence
    landing_text = response.text.lower()
    expected_terms = ["private & secure", "real-time messaging", "verified professionals"]
    assert any(term in landing_text for term in expected_terms), "Landing page missing key feature overview text"


test_landing_page_accessibility()
