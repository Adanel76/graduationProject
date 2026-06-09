from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .config import settings

SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


def normalize_email(email: str | None) -> str:
    return str(email or "").strip().lower()


def decode_token(token: str) -> dict:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise credentials_exception from exc


def get_current_user_from_token(token: str, db: Session):
    payload = decode_token(token)
    user_id = payload.get("user_id")
    email = normalize_email(payload.get("sub"))

    user = None
    if user_id is not None:
        user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None and email:
        user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(models.User).filter(models.User.email == normalize_email(email)).first()
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user


def get_user(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == normalize_email(email)).first()


def require_roles(current_user, allowed_roles: list[str]):
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
