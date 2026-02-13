"""Admin seed — ensures the system_owner user exists on startup (idempotent)."""
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.config import settings
from app.models.user import User, UserRole

logger = logging.getLogger("catshy.seed")


async def seed_admin(db: AsyncSession):
    """Create system_owner user from env vars if it doesn't already exist. Idempotent."""
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.info("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.")
        return

    result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
    existing = result.scalar_one_or_none()

    if existing:
        # Ensure system_owner role exists
        role_result = await db.execute(
            select(UserRole).where(UserRole.user_id == existing.id, UserRole.role == "system_owner")
        )
        if not role_result.scalar_one_or_none():
            db.add(UserRole(user_id=existing.id, role="system_owner"))
            db.add(UserRole(user_id=existing.id, role="user"))
            await db.commit()
            logger.info("Added system_owner role to existing admin user (email=%s).", settings.ADMIN_EMAIL)
        else:
            logger.info("System owner already exists (email=%s). Skipping seed.", settings.ADMIN_EMAIL)
        return

    admin = User(
        email=settings.ADMIN_EMAIL,
        name=settings.ADMIN_NAME or "Admin",
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        role="system_owner",
        is_active=True,
    )
    db.add(admin)
    await db.flush()

    # Assign roles in the separate user_roles table
    db.add(UserRole(user_id=admin.id, role="system_owner"))
    db.add(UserRole(user_id=admin.id, role="user"))
    await db.commit()
    logger.info("System owner seeded (email=%s).", settings.ADMIN_EMAIL)
