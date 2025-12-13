from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import urllib.parse

# URL encode для логина и пароля
username = urllib.parse.quote_plus("postgres")
password = urllib.parse.quote_plus("postgres")
host = "localhost"
database = "tourism_db"

SQLALCHEMY_DATABASE_URL = f"postgresql://{username}:{password}@{host}:5432/{database}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "client_encoding": "utf8",
        "options": "-c client_encoding=utf8"
    },
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
