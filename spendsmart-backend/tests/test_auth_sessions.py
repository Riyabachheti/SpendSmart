from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services.refresh_sessions import hash_refresh_token

TRUSTED_ORIGIN = {"Origin": "http://testserver"}
PASSWORD = "correct-horse-battery-staple"


def create_login_user(session_factory: sessionmaker[Session]) -> User:
    db = session_factory()
    try:
        user = User(
            email="auth-user@example.com",
            hashed_password=hash_password(PASSWORD),
            full_name="Auth User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        return user
    finally:
        db.close()


def login(client: TestClient) -> tuple[str, str]:
    response = client.post(
        "/auth/login",
        json={"email": "auth-user@example.com", "password": PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert "refresh_token" not in body
    refresh_token = client.cookies.get(settings.refresh_cookie_name)
    assert refresh_token is not None
    return body["access_token"], refresh_token


def set_refresh_cookie(client: TestClient, token: str) -> None:
    client.cookies.clear()
    client.cookies.set(
        settings.refresh_cookie_name,
        token,
        domain="testserver.local",
        path=settings.refresh_cookie_path,
    )


def test_login_sets_httponly_cookie_and_stores_only_hash(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    response = client.post(
        "/auth/login",
        json={"email": "auth-user@example.com", "password": PASSWORD},
    )
    assert response.status_code == 200
    assert "refresh_token" not in response.json()
    raw_refresh_token = client.cookies.get(settings.refresh_cookie_name)
    assert raw_refresh_token is not None

    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert f"Path={settings.refresh_cookie_path}" in set_cookie

    db = session_factory()
    try:
        session = db.query(RefreshSession).one()
        assert len(session.token_hash) == 64
        assert session.token_hash == hash_refresh_token(raw_refresh_token)
        assert session.token_hash != raw_refresh_token
    finally:
        db.close()


def test_refresh_rotates_token_and_revokes_previous_session(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    _, old_token = login(client)

    response = client.post("/auth/refresh", headers=TRUSTED_ORIGIN)

    assert response.status_code == 200
    assert "refresh_token" not in response.json()
    new_token = client.cookies.get(settings.refresh_cookie_name)
    assert new_token is not None
    assert new_token != old_token

    db = session_factory()
    try:
        sessions = db.query(RefreshSession).order_by(RefreshSession.id).all()
        assert len(sessions) == 2
        assert sessions[0].revoked_at is not None
        assert sessions[0].last_used_at is not None
        assert sessions[0].replaced_by_id == sessions[1].id
        assert sessions[1].revoked_at is None
        assert sessions[0].family_id == sessions[1].family_id
    finally:
        db.close()


def test_reusing_rotated_token_revokes_entire_session_family(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    _, old_token = login(client)
    assert client.post("/auth/refresh", headers=TRUSTED_ORIGIN).status_code == 200
    new_token = client.cookies.get(settings.refresh_cookie_name)
    assert new_token is not None

    set_refresh_cookie(client, old_token)
    replay_response = client.post("/auth/refresh", headers=TRUSTED_ORIGIN)
    assert replay_response.status_code == 401

    db = session_factory()
    try:
        sessions = db.query(RefreshSession).all()
        assert len(sessions) == 2
        assert all(item.revoked_at is not None for item in sessions)
    finally:
        db.close()

    set_refresh_cookie(client, new_token)
    assert client.post("/auth/refresh", headers=TRUSTED_ORIGIN).status_code == 401


def test_logout_revokes_current_session_and_clears_cookie(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    login(client)

    response = client.post("/auth/logout", headers=TRUSTED_ORIGIN)

    assert response.status_code == 204
    assert client.cookies.get(settings.refresh_cookie_name) is None
    db = session_factory()
    try:
        session = db.query(RefreshSession).one()
        assert session.revoked_at is not None
    finally:
        db.close()


def test_logout_all_revokes_every_session_for_user(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    login(client)
    access_token, _ = login(client)

    response = client.post(
        "/auth/logout-all",
        headers={
            **TRUSTED_ORIGIN,
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert response.status_code == 204
    db = session_factory()
    try:
        sessions = db.query(RefreshSession).all()
        assert len(sessions) == 2
        assert all(item.revoked_at is not None for item in sessions)
    finally:
        db.close()


def test_refresh_rejects_missing_or_untrusted_origin(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    create_login_user(session_factory)
    login(client)

    assert client.post("/auth/refresh").status_code == 403
    response = client.post(
        "/auth/refresh",
        headers={"Origin": "https://attacker.example"},
    )
    assert response.status_code == 403


def test_access_token_authenticates_me_endpoint(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    user = create_login_user(session_factory)
    access_token, _ = login(client)

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == user.id


def test_signup_rejects_password_over_bcrypt_byte_limit(
    client: TestClient,
) -> None:
    response = client.post(
        "/auth/signup",
        json={
            "email": "unicode-password@example.com",
            "password": "🔐" * 30,
        },
    )

    assert response.status_code == 422


def test_email_is_normalized_for_signup_uniqueness_and_login(
    client: TestClient,
) -> None:
    signup_response = client.post(
        "/auth/signup",
        json={
            "email": "  MixedCase@Example.COM  ",
            "password": PASSWORD,
        },
    )
    assert signup_response.status_code == 201
    assert signup_response.json()["email"] == "mixedcase@example.com"

    login_response = client.post(
        "/auth/login",
        json={
            "email": "MIXEDCASE@EXAMPLE.COM",
            "password": PASSWORD,
        },
    )
    assert login_response.status_code == 200

    duplicate_response = client.post(
        "/auth/signup",
        json={
            "email": "mixedcase@example.com",
            "password": PASSWORD,
        },
    )
    assert duplicate_response.status_code == 400
