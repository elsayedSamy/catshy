"""Auth router — login, register (bootstrap), token refresh"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.database import get_db
from app.config import settings
from app.models import User, RefreshToken, AuditLog
import uuid, hashlib

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "analyst"

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token() -> str:
    return str(uuid.uuid4())

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token()
    rt = RefreshToken(user_id=user.id, token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                      expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    db.add(rt)
    db.add(AuditLog(action="login", entity_type="user", entity_id=user.id, user_id=user.id, user_email=user.email))
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user={"id": user.id, "email": user.email, "name": user.name, "role": user.role})

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if any users exist (first user becomes admin)
    result = await db.execute(select(User).limit(1))
    is_first = result.scalar_one_or_none() is None
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=req.email, name=req.name, hashed_password=pwd_context.hash(req.password),
                role="admin" if is_first else req.role)
    db.add(user)
    db.add(AuditLog(action="register", entity_type="user", entity_id=user.id, user_email=req.email,
                    details={"role": user.role, "is_bootstrap": is_first}))
    await db.commit()
    return {"message": "User created", "role": user.role, "is_bootstrap": is_first}

@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()
    if not rt or rt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user.id, user.role)
    return {"access_token": access}
