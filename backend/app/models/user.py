"""User, UserRole, RefreshToken, AuthToken models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # Legacy role column kept for backward compat; real RBAC via user_roles table
    role = Column(String(50), nullable=False, default="user")
    is_active = Column(Boolean, default=True)
    mfa_secret = Column(String(255), nullable=True)  # TOTP secret, encrypted at rest
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserRole(Base):
    """Separate roles table — prevents privilege escalation via profile edits."""
    __tablename__ = "user_roles"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # system_owner | team_admin | team_member | user

    __table_args__ = (
        # One role per user per type
        {"schema": None},
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthToken(Base):
    """One-time tokens for invite sign-up, password reset, email verification."""
    __tablename__ = "auth_tokens"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    token_type = Column(String(20), nullable=False)  # invite | reset | verify_email
    email = Column(String(255), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    role = Column(String(50), default="user")
    name = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
