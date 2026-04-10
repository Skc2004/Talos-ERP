import pandas as pd
from prophet import Prophet
from supabase import create_client, Client
import os
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def fetch_historical_data(sku_id: str) -> pd.DataFrame:
    """
    Fetches the stock ledger data for a given SKU and converts it to time series format.
    """
    response = supabase.table("stock_ledger").select("*").eq("sku_id", sku_id).eq("transaction_type", "STOCK_ISSUE").execute()
    data = response.data
    
    if not data:
        return pd.DataFrame(columns=['ds', 'y'])
        
    df = pd.DataFrame(data)
    # Convert created_at to ds and aggregate daily quantity
    df['ds'] = pd.to_datetime(df['created_at']).dt.date
    # Issues are negative in ledger usually, but let's take absolute values for demand
    df['y'] = df['quantity'].abs() 
    
    # Aggregate daily
    daily_demand = df.groupby('ds')['y'].sum().reset_index()
    return daily_demand

def run_forecast_for_sku(sku_id: str, periods: int = 30):
    """
    Runs Facebook Prophet model directly on the historical stock issues 
    to forecast future demand.
    """
    df = fetch_historical_data(sku_id)
    if len(df) < 5:
        logger.warning(f"Not enough data to run Prophet for SKU {sku_id}")
        return None
        
    m = Prophet()
    # Add Indian Holidays
    m.add_country_holidays(country_name='IN')
    m.fit(df)
    
    future = m.make_future_dataframe(periods=periods)
    forecast = m.predict(future)
    
    # Filter only future dates
    today = pd.to_datetime(datetime.today().date())
    future_forecast = forecast[forecast['ds'] >= today]
    
    results = []
    for _, row in future_forecast.iterrows():
        prediction_val = int(max(0, row['yhat']))
        results.append({
            "sku_id": sku_id,
            "forecasted_demand": prediction_val,
            "confidence_interval": float(row['yhat_upper'] - row['yhat_lower']),
            "target_date": row['ds'].strftime("%Y-%m-%d")
        })
        
    # Write back to Supabase
    if results:
        supabase.table("demand_forecasts").insert(results).execute()
        logger.info(f"Forecasts written for SKU {sku_id}")
        
    return results
