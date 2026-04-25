import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Database, Zap, Rocket, Download, Play, Copy, ShieldCheck, Link2 } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

export const DataIngestion = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [apiPayload, setApiPayload] = useState(JSON.stringify({
    orderNumber: "SO-API-001",
    orderDate: new Date().toISOString().split('T')[0] + "T00:00:00Z",
    customerName: "Acme Corp",
    skuId: "11111111-1111-1111-1111-111111111111",
    quantity: 100,
    unitPrice: 49.99,
    discountAmount: 0
  }, null, 2));
  const [apiResult, setApiResult] = useState<any>(null);
  const [sendingApi, setSendingApi] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) uploadFile(e.dataTransfer.files[0]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
  };

  async function uploadFile(file: File) {
    setUploading(true); setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${JAVA_API}/sales/upload-csv`, { method: 'POST', body: formData });
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || 'Upload failed' });
    }
    setUploading(false);
  }

  async function loadDemoData() {
    setLoadingDemo(true); setResult(null);
    try {
      const csvRes = await fetch('/sample_sales_data.csv');
      const csvText = await csvRes.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const file = new File([blob], 'sample_sales_data.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${JAVA_API}/sales/upload-csv`, { method: 'POST', body: formData });
      const json = await res.json();
      setResult({ ...json, isDemoData: true });
    } catch (err: any) {
      setResult({ error: err.message || 'Failed to load demo data' });
    }
    setLoadingDemo(false);
  }

  async function sendApiRequest() {
    setSendingApi(true); setApiResult(null);
    try {
      const res = await fetch(`${JAVA_API}/sales/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: apiPayload
      });
      const json = await res.json();
      if (res.ok) {
        setApiResult({ success: true, data: json });
      } else {
        setApiResult({ success: false, error: json.error || json.message || 'API Error' });
      }
    } catch (err: any) {
      setApiResult({ success: false, error: err.message });
    }
    setSendingApi(false);
  }

  function copyEndpoint() {
    navigator.clipboard.writeText(`${JAVA_API}/sales/ingest`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  function downloadTemplate() {
    const today = new Date().toISOString().split('T')[0];
    const csv = `order_number,order_date,customer_name,sku_code,quantity,unit_price,discount
SO-CUSTOM-001,${today},Your Customer,B08L5WHFT9,100,49.99,0
SO-CUSTOM-002,${today},Another Client,B08C1W5N87,5,12999.00,500
SO-CUSTOM-003,${today},Third Company,RAW-PLASTIC-001,1000,12.50,0`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'talos_sales_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Database className="text-indigo-400" /> Sales Data Ingestion
        </h2>
        <p className="text-sm text-slate-400 mt-1">Upload sales data to see P&L, margins, and KPIs update in real-time on Global Pulse.</p>
      </div>

      {/* Quick Start — Demo Data */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 border border-indigo-500/30 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="text-indigo-400" size={20} />
              <h3 className="text-lg font-semibold text-white">Quick Start — Monthly Demo Data</h3>
            </div>
            <p className="text-sm text-slate-400">Load 40 sales orders spanning Mar 1 – Apr 17. Covers all 3 SKUs with realistic Indian B2B customers.</p>
          </div>
          <button onClick={loadDemoData} disabled={loadingDemo}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/30">
            {loadingDemo ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading...</>
            ) : (
              <><Zap size={16} />Load Monthly Data</>
            )}
          </button>
        </div>
      </div>

      {/* Validation Rules Reference */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="text-emerald-400" size={18} />
          <h3 className="text-sm font-semibold text-white">Data Validation Rules</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800">
            <div className="text-slate-500 mb-1">Duplicates</div>
            <div className="text-emerald-400 font-bold">Auto-Skipped</div>
            <div className="text-slate-600 mt-0.5">by order_number</div>
          </div>
          <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800">
            <div className="text-slate-500 mb-1">Quantity</div>
            <div className="text-white font-bold">1 – 100,000</div>
            <div className="text-slate-600 mt-0.5">per line item</div>
          </div>
          <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800">
            <div className="text-slate-500 mb-1">Unit Price</div>
            <div className="text-white font-bold">$0.01 – $999K</div>
            <div className="text-slate-600 mt-0.5">per unit</div>
          </div>
          <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800">
            <div className="text-slate-500 mb-1">Discount</div>
            <div className="text-white font-bold">≤ Gross Amount</div>
            <div className="text-slate-600 mt-0.5">qty × price</div>
          </div>
          <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800">
            <div className="text-slate-500 mb-1">Net Revenue</div>
            <div className="text-amber-400 font-bold">Auto-Computed</div>
            <div className="text-slate-600 mt-0.5">(qty×price)−disc</div>
          </div>
        </div>
      </div>

      {/* Upload Methods Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* CSV Upload */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="text-emerald-400" size={20} />
            <h3 className="text-lg font-medium text-white">CSV Upload</h3>
          </div>
          <p className="text-xs text-slate-400">Drag and drop your sales CSV. Required columns:</p>
          <code className="block text-[10px] bg-[#0F172A] p-3 rounded-lg text-slate-300 font-mono">
            order_number, order_date, customer_name, sku_code, quantity, unit_price, discount
          </code>

          <div className="text-xs text-slate-500 bg-[#0F172A] p-3 rounded-lg border border-slate-800">
            <div className="font-bold text-slate-400 mb-1">Available SKU Codes:</div>
            <div className="space-y-1">
              <div><span className="text-emerald-400 font-mono">B08L5WHFT9</span> — Echo Dot 4th Gen ($49.99)</div>
              <div><span className="text-emerald-400 font-mono">B08C1W5N87</span> — MacBook Air M1 ($12,999)</div>
              <div><span className="text-emerald-400 font-mono">RAW-PLASTIC-001</span> — HDPE Granules ($12.50)</div>
            </div>
          </div>

          <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500'
            }`}
            onClick={() => document.getElementById('csv-input')?.click()}>
            <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-300">Processing CSV...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="text-slate-500" size={32} />
                <span className="text-sm text-slate-400">Drop CSV here or click to browse</span>
              </div>
            )}
          </div>

          <button onClick={downloadTemplate}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
            <Download size={12} /> Download blank template
          </button>
        </div>

        {/* Live API Connection */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="text-amber-400" size={20} />
            <h3 className="text-lg font-medium text-white">Connect Data API</h3>
          </div>
          <p className="text-xs text-slate-400">Send a single order via JSON API — test it live right here:</p>

          {/* Endpoint */}
          <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-800 rounded-lg p-3">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">POST</span>
            <span className="text-sm text-white font-mono flex-1 truncate">{JAVA_API}/sales/ingest</span>
            <button onClick={copyEndpoint} className="text-xs text-slate-400 hover:text-white transition-colors">
              {copiedUrl ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Editable Payload */}
          <textarea
            value={apiPayload}
            onChange={(e) => setApiPayload(e.target.value)}
            rows={10}
            className="w-full bg-[#0F172A] border border-slate-800 rounded-lg p-3 text-xs text-emerald-400 font-mono resize-none focus:outline-none focus:border-indigo-500"
            spellCheck={false}
          />

          <button onClick={sendApiRequest} disabled={sendingApi}
            className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
            {sendingApi ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
            ) : (
              <><Play size={16} />Send API Request</>
            )}
          </button>

          {/* API Result */}
          {apiResult && (
            <div className={`text-xs p-3 rounded-lg border ${apiResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              {apiResult.success ? (
                <div>
                  <div className="font-bold mb-1">✓ Order Created</div>
                  <div className="text-slate-400">Order: {apiResult.data.orderNumber}</div>
                  <div className="text-slate-400">Revenue: ${apiResult.data.netRevenue?.toLocaleString()}</div>
                </div>
              ) : (
                <div>
                  <div className="font-bold mb-1">✗ Validation Error</div>
                  <div>{apiResult.error}</div>
                </div>
              )}
            </div>
          )}

          {/* Integration Examples */}
          <div className="text-[10px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-500">Integration targets:</div>
            <div>• Shopify Webhooks → POST to /sales/ingest on order.created</div>
            <div>• POS Systems → Batch CSV export daily</div>
            <div>• Python scripts → requests.post(url, json=payload)</div>
          </div>
        </div>
      </div>

      {/* Upload / API Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`border rounded-xl p-5 shadow-sm ${result.error
            ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.error ? <AlertTriangle className="text-red-400" size={20} /> : <CheckCircle2 className="text-emerald-400" size={20} />}
            <h4 className="font-semibold text-white">{result.error ? 'Upload Error' : (result.isDemoData ? 'Monthly Demo Data Loaded!' : 'Upload Complete')}</h4>
          </div>
          {result.error ? (
            <p className="text-sm text-red-300">{result.error}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0F172A] p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-500">Imported</div>
                  <div className="text-lg font-bold text-emerald-400">{result.imported}</div>
                </div>
                {result.duplicatesSkipped > 0 && (
                  <div className="bg-[#0F172A] p-3 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500">Duplicates Skipped</div>
                    <div className="text-lg font-bold text-amber-400">{result.duplicatesSkipped}</div>
                  </div>
                )}
                {result.errors > 0 && (
                  <div className="bg-[#0F172A] p-3 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500">Errors</div>
                    <div className="text-lg font-bold text-red-400">{result.errors}</div>
                  </div>
                )}
                {result.totalRevenueAfterImport && (
                  <div className="bg-[#0F172A] p-3 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500">Total System Revenue</div>
                    <div className="text-lg font-bold text-white">${parseFloat(result.totalRevenueAfterImport).toLocaleString()}</div>
                  </div>
                )}
                {result.totalOrdersInSystem && (
                  <div className="bg-[#0F172A] p-3 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500">Total Orders</div>
                    <div className="text-lg font-bold text-white">{result.totalOrdersInSystem}</div>
                  </div>
                )}
              </div>

              {result.isDemoData && (
                <p className="text-sm text-indigo-300">↻ Go back to <strong>Global Pulse</strong> to see the KPIs update with real revenue data!</p>
              )}
              
              {result.errorDetails?.length > 0 && (
                <div className="bg-[#0F172A] p-3 rounded-lg max-h-32 overflow-y-auto border border-slate-800">
                  <div className="text-xs text-slate-500 mb-1 font-bold">Details:</div>
                  {result.errorDetails.map((e: string, i: number) => (
                    <div key={i} className="text-xs text-slate-400">{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
