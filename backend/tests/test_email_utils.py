import importlib


def test_email_codes_are_numeric_and_have_expected_length(app_client):
    email_utils = importlib.import_module("app.email_utils")

    verification = email_utils.generate_verification_code()
    reset = email_utils.generate_reset_code(8)

    assert verification.isdigit()
    assert len(verification) == 6
    assert reset.isdigit()
    assert len(reset) == 8


def test_smtp_app_password_is_normalized(app_client):
    email_utils = importlib.import_module("app.email_utils")

    assert email_utils._normalize_smtp_password("abcd efgh ijkl mnop") == "abcdefghijklmnop"
    assert email_utils._normalize_smtp_password("") == ""
