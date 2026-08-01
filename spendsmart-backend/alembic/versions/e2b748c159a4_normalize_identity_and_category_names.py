"""normalize identity and category names

Revision ID: e2b748c159a4
Revises: d8a31f409c62
Create Date: 2026-07-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e2b748c159a4"
down_revision: str | Sequence[str] | None = "d8a31f409c62"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT lower(trim(email))
                FROM users
                GROUP BY lower(trim(email))
                HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION
                    'cannot normalize users.email: case-insensitive duplicates exist';
            END IF;
        END
        $$
        """
    )
    op.execute("UPDATE users SET email = lower(trim(email))")
    op.create_check_constraint(
        "ck_users_email_normalized",
        "users",
        "email = lower(trim(email))",
    )
    op.create_index(
        "uq_users_email_lower",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )
    op.drop_index("ix_users_email", table_name="users")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT lower(trim(name))
                FROM categories
                WHERE user_id IS NULL
                GROUP BY lower(trim(name))
                HAVING count(*) > 1
            ) OR EXISTS (
                SELECT user_id, lower(trim(name))
                FROM categories
                WHERE user_id IS NOT NULL
                GROUP BY user_id, lower(trim(name))
                HAVING count(*) > 1
            ) OR EXISTS (
                SELECT 1
                FROM categories AS system_category
                JOIN categories AS custom_category
                  ON lower(trim(custom_category.name))
                   = lower(trim(system_category.name))
                WHERE system_category.user_id IS NULL
                  AND custom_category.user_id IS NOT NULL
            ) THEN
                RAISE EXCEPTION
                    'cannot normalize categories.name: visible-name conflicts exist';
            END IF;
        END
        $$
        """
    )
    op.execute("UPDATE categories SET name = trim(name)")
    op.create_check_constraint(
        "ck_categories_name_normalized",
        "categories",
        "name = trim(name) AND length(name) > 0",
    )
    op.create_index(
        "uq_categories_system_name_lower",
        "categories",
        [sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL"),
    )
    op.create_index(
        "uq_categories_user_name_lower",
        "categories",
        ["user_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    op.drop_constraint(
        "uq_category_user_name",
        "categories",
        type_="unique",
    )
    op.execute(
        """
        CREATE FUNCTION prevent_category_name_shadowing()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            -- The two partial unique indexes cannot protect a system/custom
            -- collision because those rows live in different index
            -- predicates. Serialize writes for the same normalized name so
            -- two concurrent transactions cannot both pass the check below.
            PERFORM pg_advisory_xact_lock(
                hashtext('spendsmart.categories'),
                hashtext(lower(NEW.name))
            );

            IF EXISTS (
                SELECT 1
                FROM categories AS existing
                WHERE existing.id IS DISTINCT FROM NEW.id
                  AND lower(existing.name) = lower(NEW.name)
                  AND (
                      existing.user_id IS NULL
                      OR NEW.user_id IS NULL
                      OR existing.user_id = NEW.user_id
                  )
            ) THEN
                RAISE EXCEPTION 'category name conflicts with a visible category'
                    USING ERRCODE = '23505',
                          CONSTRAINT = 'uq_category_visible_name';
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_prevent_category_name_shadowing
        BEFORE INSERT OR UPDATE OF name, user_id ON categories
        FOR EACH ROW
        EXECUTE FUNCTION prevent_category_name_shadowing()
        """
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_category_user_name",
        "categories",
        ["user_id", "name"],
    )
    op.execute(
        "DROP TRIGGER IF EXISTS trg_prevent_category_name_shadowing ON categories"
    )
    op.execute("DROP FUNCTION IF EXISTS prevent_category_name_shadowing()")
    op.drop_index("uq_categories_user_name_lower", table_name="categories")
    op.drop_index("uq_categories_system_name_lower", table_name="categories")
    op.drop_constraint(
        "ck_categories_name_normalized",
        "categories",
        type_="check",
    )
    op.create_index(
        "ix_users_email",
        "users",
        ["email"],
        unique=True,
    )
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_constraint(
        "ck_users_email_normalized",
        "users",
        type_="check",
    )
