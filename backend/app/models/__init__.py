"""CATSHY Models — re-export all models for backward compatibility and Alembic discovery."""

from app.models.user import User, UserRole, RefreshToken, AuthToken
from app.models.workspace import Workspace, WorkspaceMember
from app.models.system import AuditLog, FeatureFlag, PendingOwnerRequest, SystemAuditLog
from app.models.intel import (
    IntelItem, Observable, IntelObservable, IntelMatch,
    SourceStats, UserFeedback,
    Entity, EntityRelationship,
)
from app.models.operations import (
    Asset, Source, AlertRule, Alert, Investigation, Case,
    Report, LeakItem, Playbook, PlaybookRun,
)
from app.models.integrations import WorkspaceIntegration, WorkspaceSettings

__all__ = [
    "User", "UserRole", "RefreshToken", "AuthToken",
    "Workspace", "WorkspaceMember",
    "AuditLog", "FeatureFlag", "PendingOwnerRequest", "SystemAuditLog",
    "IntelItem", "Observable", "IntelObservable", "IntelMatch",
    "SourceStats", "UserFeedback",
    "Entity", "EntityRelationship",
    "Asset", "Source", "AlertRule", "Alert", "Investigation", "Case",
    "Report", "LeakItem", "Playbook", "PlaybookRun",
    "WorkspaceIntegration", "WorkspaceSettings",
]
