"""Secure in-memory OTP service for ILF development/small deployments."""
import hmac
import logging
import random
import smtplib
import string
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from backend import config

_otp_store = {}
log = logging.getLogger("ilf.otp")

def _generate_digits():
    return "".join(random.choices(string.digits, k=config.OTP_LENGTH))

def issue_otp(email, otp_type):
    email = str(email).strip().lower()
    code = _generate_digits()
    _otp_store[f"{email}:{otp_type}"] = {
        "code": code,
        "expires": time.time() + config.OTP_EXPIRY_SECONDS,
        "attempts": 0,
    }
    _send_otp_email(email, code, otp_type)
    return True, code

def verify_otp(email, submitted, otp_type):
    key = f"{str(email).strip().lower()}:{otp_type}"
    entry = _otp_store.get(key)
    if not entry:
        return False, "No OTP found. Please request a new one."
    if time.time() > entry["expires"]:
        _otp_store.pop(key, None)
        return False, "OTP has expired. Please request a new one."
    entry["attempts"] += 1
    if entry["attempts"] > 5:
        _otp_store.pop(key, None)
        return False, "Too many attempts. Please request a new OTP."
    valid = hmac.compare_digest(str(entry["code"]), str(submitted).strip())
    if not valid:
        return False, "Incorrect OTP. Please try again."
    _otp_store.pop(key, None)
    return True, "ok"

def _send_otp_email(email, code, otp_type):
    subject = {"signup": "Verify your ILF account", "reset": "Reset your ILF password"}.get(otp_type, "Your ILF verification code")
    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2>Intelligent Log Forensic</h2><p>Your verification code is:</p>
      <div style="padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700">{code}</div>
      <p>This code expires in 30 minutes. If you did not request it, ignore this email.</p>
    </div>"""
    if not config.EMAIL_ENABLED:
        print(f"\n[ILF DEV] OTP for {email} ({otp_type}): {code} [expires in 30m]\n")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"], msg["From"], msg["To"] = subject, config.SMTP_FROM, email
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=5) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASS)
            server.sendmail(config.SMTP_FROM, [email], msg.as_string())
        return True
    except Exception as exc:
        log.warning("SMTP delivery failed for %s (%s). Using dev fallback.", email, exc)
        print(f"\n[ILF DEV FALLBACK] OTP for {email} ({otp_type}): {code} [expires in 30m]\n")
        return True
