import random
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings


def generate_verification_code(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def generate_reset_code(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def _normalize_smtp_password(password: str) -> str:
    # Gmail показывает пароль приложения группами через пробелы.
    # SMTP принимает пароль без пробелов.
    return "".join(str(password or "").split())


def _sender_header() -> str:
    if settings.email_from_name:
        return f"{settings.email_from_name} <{settings.email_from}>"
    return settings.email_from


def _send_html_email(recipient: str, subject: str, html_content: str) -> bool:
    if not settings.email_enabled:
        print(f"[email skipped] EMAIL_ENABLED=false -> {recipient} / {subject}")
        return False

    if not settings.email_is_configured():
        print(
            "[email skipped] SMTP config is incomplete -> "
            f"recipient={recipient}, subject={subject}, "
            f"host={bool(settings.email_host)}, from={bool(settings.email_from)}, "
            f"username={bool(settings.email_username)}, password={bool(settings.email_password)}"
        )
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = _sender_header()
    message["To"] = recipient
    message.attach(MIMEText(html_content, "html", "utf-8"))

    context = ssl.create_default_context()
    username = settings.email_username or settings.email_from
    password = _normalize_smtp_password(settings.email_password)

    try:
        if settings.email_use_ssl or int(settings.email_port) == 465:
            with smtplib.SMTP_SSL(settings.email_host, settings.email_port, timeout=settings.email_timeout, context=context) as server:
                server.login(username, password)
                server.sendmail(settings.email_from, recipient, message.as_string())
        else:
            with smtplib.SMTP(settings.email_host, settings.email_port, timeout=settings.email_timeout) as server:
                server.ehlo()
                if settings.email_use_tls:
                    server.starttls(context=context)
                    server.ehlo()
                server.login(username, password)
                server.sendmail(settings.email_from, recipient, message.as_string())

        print(f"[email sent] {recipient} / {subject}")
        return True
    except Exception as exc:
        print(
            f"[email failed] recipient={recipient}, subject={subject}, "
            f"host={settings.email_host}:{settings.email_port}, "
            f"from={settings.email_from}, username={username}, error={exc!r}"
        )
        return False


def send_test_email(email: str):
    return _send_html_email(
        email,
        "Тестовое письмо - Travel Agency",
        """
        <h2>Travel Agency</h2>
        <p>SMTP-рассылка работает корректно.</p>
        <p>Если вы получили это письмо, коды подтверждения и письма по бронированиям тоже должны приходить.</p>
        """,
    )


def send_verification_email(email: str, verification_code: str):
    return _send_html_email(
        email,
        "Подтверждение регистрации - Travel Agency",
        f"""
        <h2>Подтверждение регистрации</h2>
        <p>Ваш код подтверждения:</p>
        <div style="font-size:28px;font-weight:800;letter-spacing:4px">{verification_code}</div>
        <p>Код действует ограниченное время. Никому его не сообщайте.</p>
        """,
    )


def send_reset_password_email(email: str, reset_code: str):
    return _send_html_email(
        email,
        "Сброс пароля - Travel Agency",
        f"""
        <h2>Сброс пароля</h2>
        <p>Ваш код для восстановления доступа:</p>
        <div style="font-size:28px;font-weight:800;letter-spacing:4px">{reset_code}</div>
        """,
    )


def send_booking_confirmation_email(email: str, booking_data: dict):
    return _send_html_email(
        email,
        f"Подтверждение бронирования тура - {booking_data.get('tour_title', 'Tour')}",
        f"""
        <h2>Бронирование создано</h2>
        <p>Тур: <strong>{booking_data.get('tour_title', '—')}</strong></p>
        <p>Статус: <strong>{booking_data.get('status_label', booking_data.get('status', 'Ожидает подтверждения'))}</strong></p>
        <p>Количество туристов: <strong>{booking_data.get('people_count', '—')}</strong></p>
        <p>Сумма: <strong>{booking_data.get('total_price', '—')}</strong></p>
        <p>Спасибо, что выбрали Travel Agency.</p>
        """,
    )


def send_booking_status_update_email(email: str, booking_data: dict):
    return _send_html_email(
        email,
        f"Обновление статуса бронирования - {booking_data.get('tour_title', 'Tour')}",
        f"""
        <h2>Статус бронирования обновлен</h2>
        <p>Тур: <strong>{booking_data.get('tour_title', '—')}</strong></p>
        <p>Новый статус: <strong>{booking_data.get('status_label', booking_data.get('status', 'pending'))}</strong></p>
        """,
    )


def send_welcome_email(email: str, user_name: str):
    return _send_html_email(
        email,
        "Добро пожаловать в Travel Agency",
        f"<h2>Добро пожаловать, {user_name}!</h2><p>Ваш аккаунт успешно подтвержден.</p>",
    )
