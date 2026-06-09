"""Add custom tour plans

Revision ID: 20260607_0002
Revises: 20260426_0001
Create Date: 2026-06-07
"""

import sqlalchemy as sa
from alembic import op


revision = "20260607_0002"
down_revision = "20260426_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_tour_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("people_count", sa.Integer(), nullable=False),
        sa.Column("budget", sa.Numeric(12, 2), nullable=True),
        sa.Column("pace", sa.String(length=30), nullable=False, server_default="balanced"),
        sa.Column("interest", sa.String(length=50), nullable=False, server_default="culture"),
        sa.Column("package_type", sa.String(length=30), nullable=False, server_default="comfort"),
        sa.Column("services_json", sa.Text(), nullable=False),
        sa.Column("route_json", sa.Text(), nullable=False),
        sa.Column("activities_json", sa.Text(), nullable=False),
        sa.Column("program_json", sa.Text(), nullable=False),
        sa.Column("special_requests", sa.Text(), nullable=True),
        sa.Column("base_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("services_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("estimated_total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_custom_tour_plans_id", "custom_tour_plans", ["id"])
    op.create_index("ix_custom_tour_plans_user_id", "custom_tour_plans", ["user_id"])
    op.create_index("ix_custom_tour_plans_status", "custom_tour_plans", ["status"])


def downgrade() -> None:
    op.drop_index("ix_custom_tour_plans_status", table_name="custom_tour_plans")
    op.drop_index("ix_custom_tour_plans_user_id", table_name="custom_tour_plans")
    op.drop_index("ix_custom_tour_plans_id", table_name="custom_tour_plans")
    op.drop_table("custom_tour_plans")
