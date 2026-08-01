"""add ocr_status to expenses

Revision ID: 4834072acf2b
Revises: cc566008708f
Create Date: 2026-07-29 14:00:17.172565

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4834072acf2b'
down_revision: Union[str, Sequence[str], None] = 'cc566008708f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    ocr_status_enum = sa.Enum('pending', 'processing', 'completed', 'failed', name='ocrstatus')
    ocr_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('expenses', sa.Column('ocr_status', ocr_status_enum, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('expenses', 'ocr_status')
    sa.Enum(name='ocrstatus').drop(op.get_bind(), checkfirst=True)