"""
otp_service.py — ILF OTP Management
SECURITY: OTPs are NEVER logged, never returned in API responses.
They are only delivered via email (SMTP).
Expiry: 30 minutes (Config.OTP_EXPIRY_SECONDS).
"""
import random, string, time, smtplib, logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import Config

# In-memory OTP store { email -> {hash, expires, type, attempts} }
# Replace with Redis in production.
_otp_store: dict = {}

# Filtered logger — OTP values are redacted at source
log = logging.getLogger('ilf.otp')


def _generate_digits() -> str:
    """Generate a 6-digit numeric OTP. Value is NOT logged."""
    return ''.join(random.choices(string.digits, k=Config.OTP_LENGTH))


def issue_otp(email: str, otp_type: str) -> bool:
    """
    Generate and store an OTP for email+type.
    Returns True on success, False on error.
    OTP is sent to email ONLY — never returned from this function.
    """
    code = _generate_digits()
    _otp_store[f'{email}:{otp_type}'] = {
        'code':     code,
        'expires':  time.time() + Config.OTP_EXPIRY_SECONDS,
        'attempts': 0,
    }
    # Log that we issued one, NOT the value
    log.info('OTP issued for %s (type=%s) [value redacted]', email, otp_type)
    return _send_otp_email(email, code, otp_type)


def verify_otp(email: str, submitted: str, otp_type: str) -> tuple[bool, str]:
    """
    Verify submitted OTP.
    Returns (True, 'ok') or (False, reason).
    submitted value is NOT logged.
    """
    key   = f'{email}:{otp_type}'
    entry = _otp_store.get(key)

    if not entry:
        log.info('OTP verify failed — no entry for %s (type=%s)', email, otp_type)
        return False, 'No OTP found. Please request a new one.'

    if time.time() > entry['expires']:
        _otp_store.pop(key, None)
        log.info('OTP verify failed — expired for %s', email)
        return False, 'OTP has expired. Please request a new one.'

    entry['attempts'] += 1
    if entry['attempts'] > 5:
        _otp_store.pop(key, None)
        log.warning('OTP locked — too many attempts for %s', email)
        return False, 'Too many attempts. Please request a new OTP.'

    # Constant-time comparison to prevent timing attacks
    import hmac
    valid = hmac.compare_digest(str(entry['code']).encode(), str(submitted).encode())
    if not valid:
        log.info('OTP verify failed — wrong value for %s [attempt %d]', email, entry['attempts'])
        return False, 'Incorrect OTP. Please try again.'

    _otp_store.pop(key, None)
    log.info('OTP verified successfully for %s', email)
    return True, 'ok'


def _send_otp_email(email: str, code: str, otp_type: str) -> bool:
    """
    Send OTP via SMTP. If SMTP not configured, prints to stdout only
    (for development) — still NOT logged to file.
    """
    subject = {
        'signup':   'Verify your ILF account',
        'reset':    'Reset your ILF password',
    }.get(otp_type, 'Your ILF verification code')

    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#2D2B6B;margin-bottom:8px;">Intelligent Log Forensic</h2>
      <p style="color:#6B6880;margin-bottom:24px;">Your verification code is:</p>
      <div style="background:#F7F6F3;border:2px solid #E4E2DE;border-radius:12px;
                  padding:24px;text-align:center;letter-spacing:12px;
                  font-size:32px;font-weight:700;color:#1C1B20;
                  font-family:'Courier New',monospace;">
        {code}
      </div>
      <p style="color:#9C99AC;font-size:13px;margin-top:20px;">
        This code expires in <strong>30 minutes</strong>.<br>
        If you did not request this, please ignore this email.
      </p>
    </div>
    """

    if not Config.EMAIL_ENABLED:
        # Dev mode: print but NEVER log to file
        print(f'\n[ILF DEV] OTP for {email} ({otp_type}): {code}  [expires in 30m]\n')
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = Config.SMTP_FROM
        msg['To']      = email
        msg.attach(MIMEText(body_html, 'html'))

        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(Config.SMTP_USER, Config.SMTP_PASS)
            server.sendmail(Config.SMTP_FROM, [email], msg.as_string())

        log.info('OTP email sent to %s [value redacted]', email)
        return True
    except Exception as e:
        log.error('SMTP error for %s: %s', email, str(e))
        return False
