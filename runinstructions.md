Here are the commands to run all 3 services of Talos ERP. Open **3 separate terminals**:

### Terminal 1 — Frontend (React)
```powershell
cd c:\Users\sudee\Desktop\work\ERP\Talos-ERP\WarehouseFrontend
npm run dev
```
→ Opens at **http://localhost:5173**

### Terminal 2 — Java Backend (Spring Boot)
```powershell
$env:Path += ";C:\Users\sudee\maven\apache-maven-3.9.14\bin"
cd c:\Users\sudee\Desktop\work\ERP\Talos-ERP\InventoryMaintainer
mvn spring-boot:run
```
→ Runs on **http://localhost:8080**

### Terminal 3 — Python AI Gateway (FastAPI)
```powershell
cd c:\Users\sudee\Desktop\work\ERP\Talos-ERP\InsightMantra
python main.py
```
→ Runs on **http://localhost:8000**

### Optional — Celery Worker (4th terminal)
```powershell
cd c:\Users\sudee\Desktop\work\ERP\Talos-ERP\InsightMantra
python -m celery -A tasks worker --loglevel=info --pool=solo
```

---

### Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `admin@talos.com` |
| **Password** | `TalosAdmin@2026` |