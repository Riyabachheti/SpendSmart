from decimal import Decimal
from typing import Annotated

from pydantic import Field

MoneyAmount = Annotated[
    Decimal,
    Field(gt=0, max_digits=10, decimal_places=2),
]

NonNegativeMoneyAmount = Annotated[
    Decimal,
    Field(ge=0, max_digits=10, decimal_places=2),
]

CurrencyCode = Annotated[
    str,
    Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"),
]
