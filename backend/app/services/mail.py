"""SMTP mail service — sends invite and reset emails via Gmail (or any SMTP)."""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger("catshy.mail")


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASS)


def validate_smtp_config():
    """Call at startup to log a clear warning if SMTP is not configured."""
    if not _smtp_configured():
        logger.warning("SMTP is NOT configured. Email features (invite, reset) will be disabled. "
                       "Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env file.")
    else:
        logger.info("SMTP configured: host=%s port=%d from=%s",
                     settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_FROM_EMAIL or settings.SMTP_USER)


def _send(to_email: str, subject: str, html_body: str):
    if not _smtp_configured():
        logger.error("Cannot send email — SMTP not configured.")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    if settings.SMTP_REPLY_TO:
        msg["Reply-To"] = settings.SMTP_REPLY_TO
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(msg["From"], [to_email], msg.as_string())
        server.quit()
        logger.info("Email sent to %s subject=%s", to_email, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        raise


def send_invite_email(to_email: str, token: str, inviter_name: str = "Admin"):
    link = f"{settings.FRONTEND_BASE_URL}{settings.INVITE_PATH}?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#06b6d4;">You've been invited to CATSHY</h2>
        <p>{inviter_name} has invited you to join the CATSHY Threat Intelligence Platform.</p>
        <p>Click the button below to set your password and activate your account:</p>
        <a href="{link}" style="display:inline-block;padding:12px 24px;background:#06b6d4;color:#fff;
           text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">Accept Invite</a>
        <p style="color:#888;font-size:12px;">This link expires in {settings.INVITE_TOKEN_TTL_MIN} minutes.
        If you didn't expect this, ignore this email.</p>
    </div>
    """
    _send(to_email, "CATSHY — You're Invited", html)


def send_reset_email(to_email: str, token: str):
    link = f"{settings.FRONTEND_BASE_URL}{settings.RESET_PATH}?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
        <h2 style="color:#06b6d4;">Reset Your Password</h2>
        <p>We received a request to reset your CATSHY password.</p>
        <a href="{link}" style="display:inline-block;padding:12px 24px;background:#06b6d4;color:#fff;
           text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">Reset Password</a>
        <p style="color:#888;font-size:12px;">This link expires in {settings.RESET_TOKEN_TTL_MIN} minutes.
        If you didn't request this, ignore this email.</p>
    </div>
    """
    _send(to_email, "CATSHY — Password Reset", html)
