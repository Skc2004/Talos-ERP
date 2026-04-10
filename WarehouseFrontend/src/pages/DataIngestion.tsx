import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Database, Zap } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

export const DataIngestion = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

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

  async function downloadTemplate() {
    const csv = `order_number,order_date,customer_name,sku_code,quantity,unit_price,discount
SO-2026-001,2026-04-01,Patel Industries,SKU-STL-001,50,1200.00,0
SO-2026-002,2026-04-02,GreenPack Ltd,SKU-HDPE-002,200,450.00,500
SO-2026-003,2026-04-03,Global Parts,SKU-CNC-003,10,8500.00,1000`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'talos_sales_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Database className="text-indigo-400" /> Sales Data Ingestion
        </h2>
        <p className="text-sm text-slate-400 mt-1">Upload your historical sales data via CSV or connect external systems via REST API.</p>
      </div>

      {/* Method Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Upload */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="text-emerald-400" size={20} />
            <h3 className="text-lg font-medium text-white">CSV Upload</h3>
          </div>
          <p className="text-xs text-slate-400">Drag and drop your sales export CSV file. Expected columns:</p>
          <code className="block text-[10px] bg-[#0F172A] p-3 rounded-lg text-slate-300 font-mono">
            order_number, order_date, customer_name, sku_code, quantity, unit_price, discount
          </code>

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
            className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors">
            Download sample template
          </button>
        </div>

        {/* API Integration */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-amber-400" size={20} />
            <h3 className="text-lg font-medium text-white">REST API</h3>
          </div>
          <p className="text-xs text-slate-400">Connect external systems (Shopify, POS, custom scripts) via JSON API:</p>
          <code className="block text-[10px] bg-[#0F172A] p-3 rounded-lg text-emerald-400 font-mono whitespace-pre-wrap">
{`POST /api/v1/sales/ingest
Content-Type: application/json

{
  "orderNumber": "SO-2026-100",
  "orderDate": "2026-04-10T00:00:00Z",
  "customerName": "Acme Corp",
  "skuId": "<uuid>",
  "quantity": 100,
  "unitPrice": 1500.00,
  "discountAmount": 0
}`}
          </code>

          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Base URL</div>
            <div className="text-sm text-white font-mono">http://localhost:8080/api/v1/sales</div>
          </div>
        </div>
      </div>

      {/* Upload Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`border rounded-xl p-5 shadow-sm ${result.error
            ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.error ? <AlertTriangle className="text-red-400" size={20} /> : <CheckCircle2 className="text-emerald-400" size={20} />}
            <h4 className="font-semibold text-white">{result.error ? 'Upload Error' : 'Upload Complete'}</h4>
          </div>
          {result.error ? (
            <p className="text-sm text-red-300">{result.error}</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-300">✓ <strong>{result.imported}</strong> orders imported successfully</p>
              {result.errors > 0 && <p className="text-amber-300">⚠ {result.errors} rows skipped due to errors</p>}
              {result.errorDetails?.length > 0 && (
                <div className="mt-2 bg-[#0F172A] p-3 rounded-lg max-h-32 overflow-y-auto">
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
