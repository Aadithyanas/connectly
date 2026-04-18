import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_realtime_discovery_feed_post_filtering():
    session = requests.Session()

    # Step 1: Attempt to access /chat without auth - should fail or redirect
    chat_url = f"{BASE_URL}/chat"
    response = session.get(chat_url, timeout=TIMEOUT, allow_redirects=False)
    assert response.status_code in (200, 302, 401), "Accessing /chat without auth should redirect or be unauthorized or 200"

    # Step 2: Discover login form at /login to get login fields and attempt session auth if possible
    login_url = f"{BASE_URL}/login"
    login_page = session.get(login_url, timeout=TIMEOUT)
    assert login_page.status_code == 200, "Login page should be accessible"

    # Since we don't have credentials, skip login and stop here if auth is required.
    # But to continue test, assume user has a valid session or token (simulate auth).
    # We'll simulate login by calling auth API directly to get an auth token if possible.
    auth_token = None
    try:
        auth_response = session.post(f"{BASE_URL}/auth/v1/authorize", timeout=TIMEOUT)
        if auth_response.ok and "token" in auth_response.json():
            auth_token = auth_response.json()["token"]
    except Exception:
        pass

    assert auth_token is not None, "Authentication not available, cannot continue test_realtime_discovery_feed_post_filtering"

    # Apply auth token to session headers
    session.headers.update({"Authorization": f"Bearer {auth_token}"})

    # Step 3: Access /chat with authentication
    chat_response = session.get(chat_url, timeout=TIMEOUT)
    assert chat_response.status_code == 200, "Authenticated access to /chat should succeed"

    # Step 4: Fetch real-time discovery feed posts with GET /api/posts
    posts_url = f"{BASE_URL}/api/posts"
    posts_response = session.get(posts_url, timeout=TIMEOUT)
    assert posts_response.status_code == 200, "Fetching posts should succeed"
    posts_data = posts_response.json()
    assert isinstance(posts_data, list), "Posts response should be a list"

    assert len(posts_data) > 0, "No posts found, cannot continue test steps that require posts"
    first_post = posts_data[0]
    user_id = first_post.get("userId") or first_post.get("authorId") or first_post.get("user_id") or first_post.get("author_id")
    assert user_id is not None, "Post should have a user identifier"

    # Simulate filtering posts by user: Assume backend supports query param ?userId=
    filtered_response = session.get(posts_url, params={"userId": user_id}, timeout=TIMEOUT)
    assert filtered_response.status_code == 200, "Fetching filtered posts should succeed"
    filtered_posts = filtered_response.json()
    assert all((post.get("userId") == user_id or post.get("authorId") == user_id or post.get("user_id") == user_id or post.get("author_id") == user_id) for post in filtered_posts), "Filtered posts should all belong to the requested user"

    assert len(filtered_posts) > 0, "No filtered posts found for user, cannot continue chat start test"

    # Step 6: Start a direct chat from a post - POST /api/messages with body referencing the user
    direct_chat_url = f"{BASE_URL}/api/messages"
    # Compose a new direct message to the post author
    direct_message_payload = {
        "recipientId": user_id,
        "message": "Test: Starting direct chat from post.",
    }

    send_msg_response = session.post(direct_chat_url, json=direct_message_payload, timeout=TIMEOUT)
    assert send_msg_response.status_code == 201, "Sending direct chat message should succeed"
    sent_message = send_msg_response.json()
    assert sent_message.get("id") is not None, "Sent message should have an id"
    assert sent_message.get("recipientId") == user_id, "Recipient ID in response should match"

    # Step 7: Verify the sent message appears in the conversation by GET /api/messages?userId=...
    time.sleep(1)  # Small delay for message propagation
    conv_response = session.get(direct_chat_url, params={"userId": user_id}, timeout=TIMEOUT)
    assert conv_response.status_code == 200, "Fetching conversation messages should succeed"
    messages = conv_response.json()
    assert any(msg.get("id") == sent_message.get("id") for msg in messages), "Sent message should appear in conversation"

test_realtime_discovery_feed_post_filtering()
