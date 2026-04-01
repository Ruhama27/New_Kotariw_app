# app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class StartGameRequest(BaseModel):
    player_count: int = Field(..., ge=2, le=4, description="Number of players (2-4)")
    buy_in: float = Field(50.0, ge=50.0, description="Buy-in amount in Birr")
    
    @field_validator('player_count')
    def validate_player_count(cls, v):
        if v not in [2, 3, 4]:
            raise ValueError('player_count must be 2, 3, or 4')
        return v

class ActionRequest(BaseModel):
    player_id: str = Field(..., description="Player ID (P1, P2, P3, or P4)")
    number: int = Field(..., ge=3, le=15, description="Ball number (3-15)")
    action: str = Field(..., description="Action type: 'add' or 'subtract'")
    
    @field_validator('player_id')
    def validate_player_id(cls, v):
        valid_ids = ['P1', 'P2', 'P3', 'P4']
        if v.upper() not in valid_ids:
            raise ValueError(f'player_id must be one of {valid_ids}')
        return v.upper()
    
    @field_validator('action')
    def validate_action(cls, v):
        if v.lower() not in ['add', 'subtract']:
            raise ValueError("action must be 'add' or 'subtract'")
        return v.lower()

class MoneyManagementRequest(BaseModel):
    table: int = Field(..., ge=0, description="Table money amount")
    chewe: int = Field(..., ge=0, description="Chewe money amount")
    kotariwe: int = Field(..., ge=0, description="Kotariwe money amount")
    deposits: List[int] = Field(..., description="List of deposit amounts")
    
    @field_validator('deposits')
    def validate_deposits(cls, v):
        if not all(d >= 0 for d in v):
            raise ValueError("All deposits must be non-negative")
        return v