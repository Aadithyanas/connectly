import requests
import os
import tempfile

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Placeholder for authentication token if needed
AUTH_TOKEN = os.getenv("PROCONNECT_AUTH_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}" if AUTH_TOKEN else "",
    "Accept": "application/json",
}

def test_instant_messaging_send_text_and_media():
    if not AUTH_TOKEN:
        print("Skipping test_instant_messaging_send_text_and_media: No authentication token provided.")
        return

    # Step 1: Get list of chats user is part of (simulate by fetching posts or chats endpoint if available)
    chats_resp = requests.get(f"{BASE_URL}/api/chats", headers=HEADERS, timeout=TIMEOUT)
    assert chats_resp.status_code == 200, f"Failed to get chats list, status: {chats_resp.status_code}"
    chats = chats_resp.json()
    assert isinstance(chats, list), "Chats response is not a list"
    assert len(chats) > 0, "No chats available to send messages in"

    chat = chats[0]
    chat_id = chat.get("id")
    assert chat_id, "Chat does not have an id"

    # Prepare endpoints
    send_message_endpoint = f"{BASE_URL}/api/messages"

    # Prepare message payloads
    text_message = {
        "chatId": chat_id,
        "type": "text",
        "content": "Hello, this is a test text message from automated test.",
    }

    # Create a temporary image file to simulate media upload
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp_media:
        tmp_media.write(
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C"
            b"\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09\x08\n\x0c\x14\x0d\x0c\x0b"
            b"\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' \x1c\x1c("
            b"7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01\"\x00\x02"
            b"\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03"
            b"\x11\x00?\x00\xd2\xcf \xff\xd9"
        )
        tmp_media.flush()
        tmp_media.seek(0)

        # Step 2: Send text message
        resp_text = requests.post(send_message_endpoint, headers={**HEADERS, "Content-Type": "application/json"},
                                  json=text_message, timeout=TIMEOUT)
        assert resp_text.status_code == 201 or resp_text.status_code == 200, f"Failed to send text message, status: {resp_text.status_code}"
        resp_text_json = resp_text.json()
        assert "id" in resp_text_json, "Response missing message id for text message"
        assert resp_text_json.get("type") == "text"
        assert resp_text_json.get("content") == text_message["content"]
        assert resp_text_json.get("status") in ["sent", "delivered", "read"], f"Unexpected delivery status: {resp_text_json.get('status')}"

        # Step 3: Send media message
        # Assuming media upload via multipart/form-data with "media" as file param and other JSON fields in 'data'
        files = {
            "media": (os.path.basename(tmp_media.name), tmp_media, "image/jpeg")
        }
        data = {
            "chatId": chat_id,
            "type": "media",
            "content": ""  # content might be empty or include caption, send empty here
        }
        resp_media = requests.post(send_message_endpoint, headers={"Authorization": HEADERS["Authorization"]}, data=data, files=files, timeout=TIMEOUT)
        assert resp_media.status_code == 201 or resp_media.status_code == 200, f"Failed to send media message, status: {resp_media.status_code}"
        resp_media_json = resp_media.json()
        assert "id" in resp_media_json, "Response missing message id for media message"
        assert resp_media_json.get("type") == "media"
        assert "mediaUrl" in resp_media_json, "Response missing mediaUrl for media message"
        assert resp_media_json.get("status") in ["sent", "delivered", "read"], f"Unexpected delivery status: {resp_media_json.get('status')}"

        # Step 4: Attempt to send empty message and expect validation error
        empty_message = {
            "chatId": chat_id,
            "type": "text",
            "content": ""
        }
        resp_empty = requests.post(send_message_endpoint, headers={**HEADERS, "Content-Type": "application/json"},
                                   json=empty_message, timeout=TIMEOUT)
        assert resp_empty.status_code == 400 or resp_empty.status_code == 422, f"Empty message not rejected as expected, status: {resp_empty.status_code}"

test_instant_messaging_send_text_and_media()