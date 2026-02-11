"""Admin seed — ensures the admin user exists on startup (idempotent)."""
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from app.config import settings
from app.models import User

logger = logging.getLogger("catshy.seed")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_admin(db: AsyncSession):
    """Create admin user from env vars if it doesn't already exist. Idempotent."""
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.info("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.")
        return

    result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
    existing = result.scalar_one_or_none()

    if existing:
        logger.info("Admin user already exists (email=%s). Skipping seed.", settings.ADMIN_EMAIL)
        return

    admin = User(
        email=settings.ADMIN_EMAIL,
        name=settings.ADMIN_NAME or "Admin",
        hashed_password=pwd_context.hash(settings.ADMIN_PASSWORD),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    logger.info("Admin user seeded (email=%s).", settings.ADMIN_EMAIL)
