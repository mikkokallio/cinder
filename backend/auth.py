"""
Entra ID Authentication for Cinder.
Validates JWT tokens from Microsoft Entra ID.
"""
import os
import logging
import time
from typing import Optional, Dict, Any
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, Cookie, status

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = 'cinder_session'
_sessions: dict[str, dict] = {}  # Simple in-memory session store


def _get_config():
    tenant_id = os.getenv('ENTRA_TENANT_ID', 'common')
    client_id = os.getenv('ENTRA_CLIENT_ID')
    issuers = [
        f'https://sts.windows.net/{tenant_id}/',
        f'https://login.microsoftonline.com/{tenant_id}/v2.0',
    ]
    audiences = [aud for aud in [client_id, f'api://{client_id}'] if aud]
    jwks_uri = f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys'
    return tenant_id, client_id, issuers, audiences, jwks_uri


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    _, _, _, _, jwks_uri = _get_config()
    return PyJWKClient(jwks_uri)


async def verify_bearer_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify Entra ID bearer token. Returns decoded claims."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing or invalid Authorization header')

    token = authorization[7:]
    _, _, issuers, audiences, _ = _get_config()

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            audience=audiences,
            issuer=issuers,
            options={'verify_exp': True},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token expired')
    except jwt.InvalidTokenError as e:
        logger.warning(f'Token validation failed: {e}')
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Dependency: extract current user from bearer token."""
    # Test bypass for development validation
    test_secret = os.getenv('CINDER_TEST_SECRET')
    if test_secret and authorization and authorization == f'Bearer {test_secret}':
        return {'preferred_username': 'test@cinder.dev', 'name': 'Test User', 'oid': 'test-oid'}
    return await verify_bearer_token(authorization)


async def verify_session_cookie(cinder_session: Optional[str] = Cookie(None)) -> Dict[str, Any]:
    """Verify session cookie for forward_auth gate."""
    if not cinder_session or cinder_session not in _sessions:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='No valid session')
    session = _sessions[cinder_session]
    if session.get('expires_at', 0) < time.time():
        del _sessions[cinder_session]
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session expired')
    return session['user']


def create_session(user_claims: Dict[str, Any], ttl: int = 86400) -> str:
    """Create a session and return the session ID."""
    import secrets
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = {
        'user': {
            'preferred_username': user_claims.get('preferred_username', user_claims.get('upn', '')),
            'name': user_claims.get('name', ''),
            'oid': user_claims.get('oid', ''),
        },
        'expires_at': time.time() + ttl,
    }
    return session_id
