from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Equipment
from backend.schemas.equipment import EquipmentCreate, EquipmentResponse

router = APIRouter(prefix="/api/users/{user_id}/equipment", tags=["equipment"])


@router.get("", response_model=list[EquipmentResponse])
async def list_equipment(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Equipment).where(Equipment.user_id == user_id)
    )
    return result.scalars().all()


@router.post("", response_model=EquipmentResponse)
async def add_equipment(
    user_id: int, data: EquipmentCreate, db: AsyncSession = Depends(get_db)
):
    equip = Equipment(user_id=user_id, **data.model_dump())
    db.add(equip)
    await db.commit()
    await db.refresh(equip)
    return equip


@router.delete("/{equipment_id}")
async def remove_equipment(
    user_id: int, equipment_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Equipment).where(
            Equipment.id == equipment_id, Equipment.user_id == user_id
        )
    )
    equip = result.scalar_one_or_none()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipment not found")

    await db.delete(equip)
    await db.commit()
    return {"deleted": True}
