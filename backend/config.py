"""
config.py — ILF Backend Configuration
Centralised settings for JWT, SMTP, and DB.
SMTP credentials go in .env — never hardcoded here.
"""
import os

class Config:
    # ── JWT ─────────────────────────────────────
    JWT_SECRET_KEY      = os.getenv('ILF_JWT_SECRET', 'ilf-dev-secret-change-in-prod-2026')
    JWT_ACCESS_EXPIRES  = 3600          # 1 hour in seconds
    JWT_ALGORITHM       = 'HS256'

    # ── OTP ─────────────────────────────────────
    OTP_EXPIRY_SECONDS  = 1800          # 30 minutes, as specified
    OTP_LENGTH          = 6

    # ── SMTP (email for OTP delivery) ───────────
    SMTP_HOST           = os.getenv('ILF_SMTP_HOST', 'smtp.gmail.com')
    SMTP_PORT           = int(os.getenv('ILF_SMTP_PORT', '587'))
    SMTP_USER           = os.getenv('ILF_SMTP_USER', '')
    SMTP_PASS           = os.getenv('ILF_SMTP_PASS', '')
    SMTP_FROM           = os.getenv('ILF_SMTP_FROM', 'noreply@ilf.io')
    EMAIL_ENABLED       = bool(os.getenv('ILF_SMTP_USER', ''))

    # ── CORS ────────────────────────────────────
    CORS_ORIGINS        = ['http://localhost:3000', 'http://127.0.0.1:5500',
                           'http://localhost:5500', 'null', '*']

    # ── Logging ─────────────────────────────────
    # OTPs must NEVER appear in logs — enforced in otp_service.py
    LOG_LEVEL           = 'INFO'
    SUPPRESS_OTP_LOGS   = True
