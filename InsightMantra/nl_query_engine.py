"""
Talos ERP — Natural Language Query Engine
Gemini-powered NL→SQL with 20-template fallback for offline/rate-limited operation.
"""
import os
import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Schema Context for LLM ───
SCHEMA_CONTEXT = """
You are a SQL expert for a manufacturing ERP system built on PostgreSQL (Supabase).
The database has these tables:

1. sku_master (id UUID, sku_code, description, weight_kg, lead_time_days, reorder_point)
2. stock_ledger (id UUID, sku_id FK→sku_master, transaction_type ENUM('GOODS_INWARD','STOCK_ISSUE','FINISHED_GOODS_ENTRY','STOCK_ADJUSTMENT'), quantity INT, location, created_at)
3. sales_orders (id UUID, order_number, order_date, customer_name, sku_id FK, quantity INT, unit_price, discount_amount, net_revenue GENERATED, channel, status)
4. fin_expenses (id UUID, description, category VARCHAR, amount DECIMAL, expense_date DATE, is_recurring BOOLEAN, logged_by UUID)
5. general_ledger (id UUID, journal_entry_id UUID, account_code VARCHAR, debit DECIMAL, credit DECIMAL, description, transaction_date, is_reversed BOOLEAN)
6. chart_of_accounts (code VARCHAR PK, name, account_type ENUM('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'))
7. crm_leads (id UUID, contact_name, contact_email, company_name, potential_value DECIMAL, status ENUM('NEW','CONTACTED','QUOTED','NEGOTIATING','WON','LOST'), source, ai_score DECIMAL, notes)
8. projects (id UUID, project_name, client_name, deadline TIMESTAMPTZ, status ENUM('BACKLOG','PLANNING','IN_PROGRESS','QA','SHIPPED','CANCELLED'), priority INT, estimated_hours, machine_id)
9. hr_employees (id UUID, name, email, department, role, hourly_rate, is_active BOOLEAN)
10. purchase_orders (id UUID, po_number, vendor_id, status ENUM('DRAFT','APPROVED','RECEIVED','CLOSED'), total_amount, created_by, approved_by)
11. demand_forecasts (id UUID, sku_id FK, forecasted_demand INT, confidence_interval, target_date DATE)
12. fin_taxes (id UUID, tax_type, related_sale_id FK, taxable_amount, tax_rate_percent, computed_tax GENERATED, date_assessed, status)

Views: current_stock (sku_id, available_quantity), trial_balance (account_code, account_name, account_type, total_debit, total_credit, balance)

IMPORTANT RULES:
- Generate ONLY SELECT queries. Never INSERT, UPDATE, DELETE, DROP, or ALTER.
- Use proper PostgreSQL syntax.
- Return concise, readable results.
- Limit results to 20 rows unless user specifies otherwise.
"""

# ─── 20 Template Fallback Queries ───
TEMPLATE_QUERIES = {
    r"(show|get|what).*(p&l|pnl|profit.*(loss|margin)|income)": {
        "sql": """SELECT 
            COALESCE(SUM(net_revenue), 0) AS total_revenue,
            (SELECT COALESCE(SUM(amount), 0) FROM fin_expenses) AS total_expenses,
            COALESCE(SUM(net_revenue), 0) - (SELECT COALESCE(SUM(amount), 0) FROM fin_expenses) AS net_profit
        FROM sales_orders WHERE status = 'COMPLETED'""",
        "label": "Profit & Loss Summary"
    },
    r"top.*(lead|prospect|client)": {
        "sql": "SELECT contact_name, company_name, potential_value, ai_score, status FROM crm_leads ORDER BY ai_score DESC NULLS LAST LIMIT 10",
        "label": "Top Leads by AI Score"
    },
    r"(stock|inventory).*(alert|low|critical|below|reorder)": {
        "sql": """SELECT sm.sku_code, sm.description, cs.available_quantity, sm.reorder_point,
            CASE WHEN cs.available_quantity <= sm.reorder_point THEN 'REORDER NOW' ELSE 'OK' END AS alert
        FROM sku_master sm LEFT JOIN current_stock cs ON sm.id = cs.sku_id
        ORDER BY cs.available_quantity ASC NULLS FIRST LIMIT 15""",
        "label": "Inventory Alerts"
    },
    r"(expense|cost).*(categor|breakdown|by type)": {
        "sql": "SELECT category, COUNT(*) AS count, SUM(amount) AS total FROM fin_expenses GROUP BY category ORDER BY total DESC",
        "label": "Expenses by Category"
    },
    r"(revenue|sales).*(month|monthly|trend)": {
        "sql": """SELECT DATE_TRUNC('month', order_date) AS month, COUNT(*) AS orders, SUM(net_revenue) AS revenue
        FROM sales_orders WHERE status = 'COMPLETED' GROUP BY month ORDER BY month DESC LIMIT 12""",
        "label": "Monthly Revenue Trend"
    },
    r"(revenue|sales).*(customer|client|who)": {
        "sql": "SELECT customer_name, COUNT(*) AS orders, SUM(net_revenue) AS total_revenue FROM sales_orders GROUP BY customer_name ORDER BY total_revenue DESC LIMIT 10",
        "label": "Revenue by Customer"
    },
    r"(project|shop).*(overdue|late|at.risk|deadline)": {
        "sql": """SELECT project_name, client_name, deadline, status, priority,
            EXTRACT(EPOCH FROM (deadline - NOW())) / 3600 AS hours_remaining
        FROM projects WHERE status NOT IN ('SHIPPED','CANCELLED') AND deadline < NOW() + INTERVAL '48 hours'
        ORDER BY deadline ASC""",
        "label": "At-Risk Projects"
    },
    r"(lead|crm).*(pipeline|funnel|stage)": {
        "sql": "SELECT status, COUNT(*) AS count, SUM(potential_value) AS pipeline_value FROM crm_leads GROUP BY status ORDER BY count DESC",
        "label": "CRM Pipeline Funnel"
    },
    r"(who|employee|team|staff|people)": {
        "sql": "SELECT name, email, department, role, hourly_rate FROM hr_employees WHERE is_active = TRUE ORDER BY department, name",
        "label": "Active Team Members"
    },
    r"(purchase.order|po).*(pending|draft|open)": {
        "sql": "SELECT po_number, status, total_amount, created_at FROM purchase_orders WHERE status IN ('DRAFT','APPROVED') ORDER BY created_at DESC LIMIT 15",
        "label": "Open Purchase Orders"
    },
    r"(trial.balance|balance.sheet|account)": {
        "sql": "SELECT * FROM trial_balance ORDER BY account_code",
        "label": "Trial Balance"
    },
    r"(forecast|demand|predict)": {
        "sql": """SELECT sm.sku_code, df.target_date, df.forecasted_demand, df.confidence_interval
        FROM demand_forecasts df JOIN sku_master sm ON df.sku_id = sm.id
        ORDER BY df.target_date ASC LIMIT 20""",
        "label": "Demand Forecasts"
    },
    r"(tax|gst|vat)": {
        "sql": "SELECT tax_type, SUM(taxable_amount) AS taxable, SUM(computed_tax) AS tax_due, status FROM fin_taxes GROUP BY tax_type, status ORDER BY tax_due DESC",
        "label": "Tax Summary"
    },
    r"total.*(revenue|sales|income)": {
        "sql": "SELECT COUNT(*) AS total_orders, SUM(net_revenue) AS total_revenue, AVG(net_revenue) AS avg_order_value FROM sales_orders WHERE status = 'COMPLETED'",
        "label": "Total Revenue Summary"
    },
    r"(sku|product|item).*(list|all|catalog)": {
        "sql": "SELECT sku_code, description, weight_kg, lead_time_days, reorder_point FROM sku_master ORDER BY sku_code LIMIT 20",
        "label": "SKU Catalog"
    },
    r"(machine|equipment|asset)": {
        "sql": """SELECT DISTINCT machine_id, COUNT(*) AS active_projects,
            MIN(deadline) AS nearest_deadline
        FROM projects WHERE status IN ('PLANNING','IN_PROGRESS') AND machine_id IS NOT NULL
        GROUP BY machine_id ORDER BY nearest_deadline ASC""",
        "label": "Machine Utilization"
    },
    r"(channel|source).*(sales|order|revenue)": {
        "sql": "SELECT channel, COUNT(*) AS orders, SUM(net_revenue) AS revenue FROM sales_orders GROUP BY channel ORDER BY revenue DESC",
        "label": "Revenue by Channel"
    },
    r"(recurring|subscription).*(expense|cost)": {
        "sql": "SELECT description, category, amount, expense_date FROM fin_expenses WHERE is_recurring = TRUE ORDER BY amount DESC",
        "label": "Recurring Expenses"
    },
    r"(won|closed.won|converted).*(deal|lead)": {
        "sql": "SELECT contact_name, company_name, potential_value, source FROM crm_leads WHERE status = 'WON' ORDER BY potential_value DESC",
        "label": "Won Deals"
    },
    r"(ledger|journal|entry|entries)": {
        "sql": """SELECT journal_entry_id, account_code, debit, credit, description, transaction_date, is_reversed
        FROM general_ledger ORDER BY transaction_date DESC LIMIT 20""",
        "label": "Recent Journal Entries"
    }
}


class NLQueryEngine:
    """Natural Language → SQL query engine with Gemini LLM + template fallback."""

    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.gemini_model = None
        self.gemini_client = None
        self._init_gemini()

    def _init_gemini(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not set — running in template-only mode")
            return
        try:
            from google import genai
            self.gemini_client = genai.Client(api_key=api_key)
            self.gemini_model = "gemini-2.0-flash"
            logger.info("Gemini NL→SQL engine initialized (google-genai SDK)")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")

    def _match_template(self, question: str) -> Optional[dict]:
        q = question.lower().strip()
        for pattern, query_info in TEMPLATE_QUERIES.items():
            if re.search(pattern, q):
                return query_info
        return None

    def _generate_sql_with_gemini(self, question: str) -> Optional[str]:
        if not self.gemini_model:
            return None
        try:
            prompt = f"""{SCHEMA_CONTEXT}

User question: "{question}"

Generate a single PostgreSQL SELECT query to answer this question. 
Return ONLY the raw SQL query, no markdown, no explanation, no backticks."""

            response = self.gemini_client.models.generate_content(
                model=self.gemini_model,
                contents=prompt
            )
            sql = response.text.strip()
            # Strip markdown code fences if present
            sql = re.sub(r'^```\w*\n?', '', sql)
            sql = re.sub(r'\n?```$', '', sql)
            sql = sql.strip()

            # Safety: verify it's a SELECT
            if not sql.upper().startswith("SELECT"):
                logger.warning(f"Gemini returned non-SELECT query: {sql[:50]}")
                return None
            return sql
        except Exception as e:
            logger.error(f"Gemini query generation failed: {e}")
            return None

    def query(self, question: str) -> dict:
        """Process a natural language question → SQL → execute → return results."""

        # 1. Try template match first (instant, no API call)
        template = self._match_template(question)
        if template:
            return self._execute_query(template["sql"], template["label"], "template")

        # 2. Try Gemini LLM
        gemini_sql = self._generate_sql_with_gemini(question)
        if gemini_sql:
            return self._execute_query(gemini_sql, "AI-Generated Query", "gemini")

        # 3. No match
        return {
            "status": "no_match",
            "message": "I couldn't understand that query. Try asking about P&L, leads, stock alerts, expenses, or projects.",
            "suggestions": self.get_suggestions()
        }

    def _execute_query(self, sql: str, label: str, source: str) -> dict:
        """Execute SQL against Supabase and return formatted results."""
        try:
            result = self.supabase.rpc("exec_readonly_sql", {"query_text": sql}).execute()
            return {
                "status": "success",
                "label": label,
                "source": source,
                "sql": sql,
                "data": result.data,
                "row_count": len(result.data) if result.data else 0
            }
        except Exception as e:
            # Fallback: try direct table queries for common patterns
            logger.warning(f"RPC execution failed ({e}), trying direct execution...")
            try:
                # Use postgrest for simple queries
                from supabase import Client
                result = self.supabase.postgrest.rpc("exec_readonly_sql", {"query_text": sql}).execute()
                return {
                    "status": "success",
                    "label": label,
                    "source": source,
                    "sql": sql,
                    "data": result.data,
                    "row_count": len(result.data) if result.data else 0
                }
            except:
                return {
                    "status": "error",
                    "label": label,
                    "source": source,
                    "sql": sql,
                    "message": f"Query execution failed: {str(e)}",
                    "data": []
                }

    def get_suggestions(self) -> list:
        """Return contextual query suggestions."""
        return [
            "Show me the P&L summary",
            "Top 10 leads by AI score",
            "Stock below reorder point",
            "Expenses by category",
            "Monthly revenue trend",
            "At-risk projects",
            "CRM pipeline funnel",
            "Active team members",
            "Trial balance",
            "Open purchase orders",
            "Revenue by customer",
            "Demand forecasts",
            "Won deals",
            "Recent journal entries",
            "Recurring expenses",
        ]
