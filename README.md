# Talos ERP — Enterprise Resource Planning System

An AI-powered, full-stack ERP platform inspired by SAP, built for real-time inventory management, financial analytics, CRM lead scoring, IoT predictive maintenance, and competitor intelligence.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WarehouseFrontend (React/Vite)                │
│              localhost:5173 — Dashboard, CRM, Finance            │
└──────────────────┬────────────────────────┬──────────────────────┘
                   │                        │
        ┌──────────▼──────────┐  ┌──────────▼──────────┐
        │  InventoryMaintainer │  │    InsightMantra     │
        │  (Spring Boot/Java)  │  │  (FastAPI/Python)    │
        │   localhost:8080     │  │   localhost:8000     │
        │                      │  │                      │
        │  • Inventory Rebal.  │  │  • Demand Forecasts  │
        │  • CRM CRUD + DTOs   │  │  • NLP Sentiment     │
        │  • Finance P&L       │  │  • Lead Scoring AI   │
        │  • Paginated APIs    │  │  • Predictive Maint. │
        │  • Spring Security   │  │  • Celery Async Tasks│
        └──────────┬───────────┘  └──────────┬───────────┘
                   │                          │
        ┌──────────▼──────────────────────────▼──────────┐
        │           Supabase (PostgreSQL + Auth)          │
        │         Cloud-hosted Database & Storage         │
        └──────────────────────┬──────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   IoTGateway        │
                    │  (Python Simulator) │
                    │  Telemetry → DB     │
                    └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, Framer Motion, Recharts, Lucide Icons |
| **Backend (Java)** | Spring Boot 3.2, Spring Data JPA, Spring Security, Resilience4j, Lombok |
| **Backend (Python)** | FastAPI, Celery, Prophet, HuggingFace Transformers, BeautifulSoup |
| **Database** | PostgreSQL via Supabase (cloud) |
| **IoT** | Python telemetry simulator with anomaly detection |
| **Message Queue** | Celery with SQLite broker (dev) / Redis (prod) |

---

## Project Structure

```
Talos-ERP/
├── WarehouseFrontend/       # React/Vite Dashboard
│   ├── src/pages/
│   │   ├── CrmDashboard.tsx        # Lead pipeline management
│   │   ├── FinancialDashboard.tsx   # P&L, waterfall charts, expenses
│   │   ├── LogicDebugger.tsx        # Inventory rebalancing visualizer
│   │   └── DataIngestion.tsx        # CSV upload & sales data
│   └── .env                         # API URLs (VITE_JAVA_API_URL, etc.)
│
├── InventoryMaintainer/     # Spring Boot Java Backend
│   ├── src/main/java/com/sapclone/inventory/
│   │   ├── config/
│   │   │   └── SecurityConfig.java       # Spring Security + CORS
│   │   ├── controller/
│   │   │   ├── CrmController.java        # CRM REST endpoints (DTOs)
│   │   │   ├── FinanceController.java     # P&L and expense tracking
│   │   │   ├── RebalanceController.java   # Inventory rebalancing
│   │   │   └── SalesDataController.java   # CSV ingestion
│   │   ├── dto/
│   │   │   ├── CrmLeadRequest.java        # Inbound DTO
│   │   │   ├── CrmLeadResponse.java       # Outbound DTO
│   │   │   └── DtoMapper.java             # Entity ↔ DTO mapping
│   │   ├── model/                          # JPA Entities
│   │   ├── repository/                     # Spring Data repos (Pageable)
│   │   └── service/
│   │       └── StockService.java           # Rebalancing math engine
│   └── src/main/resources/
│       └── application.properties          # DB, CORS, thresholds
│
├── InsightMantra/           # FastAPI Python AI Gateway
│   ├── main.py                    # API gateway (forecasts, NLP, maintenance)
│   ├── lead_scoring.py            # AI lead prioritization
│   ├── tasks.py                   # Celery async task definitions
│   ├── business_rules.json        # Externalized scoring weights & thresholds
│   ├── forecasting.py             # Prophet demand forecasting
│   ├── nlp_engine.py              # Sentiment analysis (HuggingFace)
│   ├── mcr_engine.py              # Market Capture Ratio engine
│   └── maintenance_service.py     # Z-Score anomaly detection
│
├── IoTGateway/              # IoT Telemetry Simulator
│   ├── simulator.py               # Machine telemetry generator
│   └── config.json                # Machine IDs & anomaly thresholds
│
└── supabase/                # Database migrations
```

---

## Quick Start

### Prerequisites

- **Java 21+** (JDK)
- **Maven 3.9+**
- **Python 3.11+**
- **Node.js 18+**

### 1. Environment Variables

Create `.env` files:

**`WarehouseFrontend/.env`**
```env
VITE_JAVA_API_URL=http://localhost:8080/api/v1
VITE_PYTHON_API_URL=http://localhost:8000
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

**`InsightMantra/.env`**
```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
ALLOWED_ORIGINS=http://localhost:5173
```

### 2. Start the Frontend

```bash
cd WarehouseFrontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Start the Java Backend

```bash
cd InventoryMaintainer
mvn spring-boot:run
# → http://localhost:8080
```

### 4. Start the Python AI Gateway

```bash
cd InsightMantra
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

### 5. Start the Celery Worker (optional, for async tasks)

```bash
cd InsightMantra
python -m celery -A tasks worker --loglevel=info --pool=solo
```

### 6. Start the IoT Simulator (optional)

```bash
cd IoTGateway
python simulator.py
```

---

## Key Features

### 📊 Financial Dashboard
- Real-time P&L with waterfall visualization
- Expense tracking with CRUD operations
- KPI cards for Revenue, COGS, EBITDA, Net Profit

### 🏭 Inventory Rebalancing Engine
- Mathematical Safety Stock & Reorder Point computation
- Z-Score based health status (configurable thresholds)
- Live stock-out projections

### 🤝 CRM Pipeline
- AI-powered lead scoring (0-100) with configurable business rules
- Full CRUD with DTO abstraction layer
- Paginated API responses for scalability
- Pipeline analytics and conversion tracking

### 🧠 AI Intelligence
- **Demand Forecasting:** Meta Prophet time-series predictions
- **Sentiment Analysis:** HuggingFace transformer-based NLP
- **Competitor MCR:** Automated market capture ratio scanning
- **Prescriptive Cards:** Cross-referenced C-Suite insight generation

### 🔧 Predictive Maintenance
- Rolling Z-Score anomaly detection on IoT telemetry
- Machine health dashboards with alert severity
- Automated maintenance order drafting

---

## Enterprise Architecture Decisions

| Concern | Implementation |
|---------|---------------|
| **CORS Security** | Centralized via Spring Security `SecurityConfig` + FastAPI env-based origins |
| **Entity Exposure** | DTOs (`CrmLeadRequest`/`CrmLeadResponse`) with `DtoMapper` utility |
| **Pagination** | Spring Data `Pageable` on all list endpoints |
| **Business Rules** | Externalized to `business_rules.json` + Spring `@Value` properties |
| **Async Processing** | Celery tasks for heavy AI workloads (lead scoring, competitor scanning) |
| **Graceful Degradation** | Frontend shows "Service Degraded" UI — no fake data injection |
| **Configuration** | All credentials, URLs, and thresholds via environment variables |
| **Circuit Breaking** | Resilience4j on inter-service calls (Java → Python) |

---

## API Reference

### Java Backend (`:8080`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/crm/leads?page=0&size=20` | Paginated leads by AI score |
| POST | `/api/v1/crm/leads` | Create lead (DTO) |
| PUT | `/api/v1/crm/leads/{id}` | Update lead (DTO) |
| DELETE | `/api/v1/crm/leads/{id}` | Delete lead |
| GET | `/api/v1/inventory/rebalance` | All SKU rebalancing metrics |
| GET | `/api/v1/finance/pnl` | Profit & Loss statement |
| GET | `/actuator/health` | Application health check |

### Python AI Gateway (`:8000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/crm/score-leads` | Trigger async AI lead scoring |
| GET | `/crm/top-leads?limit=5` | Top leads by AI score |
| POST | `/intelligence/mcr/scan` | Async competitor scan |
| GET | `/tasks/{task_id}` | Poll async task status |
| POST | `/forecasts/retrain/{sku_id}` | Retrain demand model |
| GET | `/maintenance/health` | Machine health summary |
| GET | `/intelligence/prescriptive-cards` | C-Suite insight cards |

---

## License

MIT
