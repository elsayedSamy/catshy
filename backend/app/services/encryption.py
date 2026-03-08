"""Encryption service for integration API keys using Fernet symmetric encryption.

Master key is loaded from INTEGRATIONS_MASTER_KEY env var.
Generate one: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import os
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("catshy.encryption")

_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    key = os.getenv("INTEGRATIONS_MASTER_KEY", "")
    if not key:
        raise ValueError(
            "INTEGRATIONS_MASTER_KEY not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    _fernet = Fernet(key.encode())
    return _fernet


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt an API key. Returns base64-encoded ciphertext."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """Decrypt an API key. Raises ValueError on failure."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt API key — master key may have changed")


def mask_api_key(plaintext: str) -> str:
    """Return masked key showing only last 4 characters."""
    if len(plaintext) <= 4:
        return "****"
    return "*" * (len(plaintext) - 4) + plaintext[-4:]
