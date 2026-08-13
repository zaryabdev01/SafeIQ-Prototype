from app.core.security import create_access_token, create_onboarding_token, decode_token, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    password = "correct horse battery staple"  # noqa: S105 - test fixture, not a real credential
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong password", hashed) is False


def test_access_token_roundtrip() -> None:
    token = create_access_token(subject="user-1", org_id="org-1", tenant_schema="tenant_org1", role="employee")
    claims = decode_token(token)
    assert claims["sub"] == "user-1"
    assert claims["org_id"] == "org-1"
    assert claims["tenant_schema"] == "tenant_org1"
    assert claims["role"] == "employee"
    assert claims["type"] == "access"


def test_onboarding_token_has_no_role() -> None:
    token = create_onboarding_token(subject="user-1", org_id="org-1", tenant_schema="tenant_org1")
    claims = decode_token(token)
    assert claims["type"] == "onboarding"
    assert claims["role"] == ""
