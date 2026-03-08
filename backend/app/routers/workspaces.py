"""Workspace router — list workspaces, manage workspace membership."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.workspace import Workspace, WorkspaceMember
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/")
async def list_my_workspaces(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """List all workspaces the current user is a member of."""
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.is_active == True,
            Workspace.is_active == True,
        )
        .order_by(Workspace.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": ws.id,
            "name": ws.name,
            "slug": ws.slug,
            "description": ws.description,
            "role": role,
            "created_at": str(ws.created_at),
        }
        for ws, role in rows
    ]
