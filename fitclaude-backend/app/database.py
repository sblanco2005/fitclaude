from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_connect_args = {}
if "asyncpg" in settings.database_url:
    _connect_args = {"ssl": True}

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=1,
    max_overflow=2,
    pool_timeout=10,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
