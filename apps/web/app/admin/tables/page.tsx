"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Grid2X2, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type RestaurantTable = { id: string; number: string; capacity: number; isActive: boolean; menuUrl: string };
const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.port === "3000" ? `http://${window.location.hostname}:4000` : "");
const fallbackTables = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>(fallbackTables.map((number) => ({ id: number, number, capacity: 4, isActive: true, menuUrl: `/menu/coffee-house?table=${number}` })));
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${getApiBase()}/api/v1/restaurants/coffee-house/tables`, { credentials: "include" }).then((response) => response.ok ? response.json() : Promise.reject(new Error("tables unavailable"))).then((payload) => setTables(payload.data.tables)).catch(() => undefined).finally(() => setLoading(false)); }, []);
  function menuUrl(table: RestaurantTable) { return table.menuUrl.startsWith("http") ? table.menuUrl : `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}${table.menuUrl}`; }
  function printTable(table: RestaurantTable) { const popup = window.open("", "_blank", "width=520,height=650"); if (!popup) return; popup.document.write(`<html><head><title>Стол ${table.number}</title><style>body{font-family:Arial;text-align:center;padding:40px}h1{font-size:30px}p{color:#666}</style></head><body><h1>Стол ${table.number}</h1><p>Наведите камеру, чтобы открыть меню</p><div id="qr"></div><script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"><\/script><script>QRCode.toCanvas(document.createElement('canvas'),'${menuUrl(table)}',{width:260},function(e,c){document.getElementById('qr').appendChild(c)})<\/script></body></html>`); popup.document.close(); popup.focus(); popup.print(); }
  return <main className="tables-shell"><header className="tables-topbar"><div><a className="back-link" href="/admin"><ArrowLeft size={15} /> Назад в админ-панель</a><div className="tables-title"><span className="tables-title-icon"><Grid2X2 size={18} /></span><div><p className="section-kicker">COFFEE HOUSE · ADMIN</p><h1>Все столы</h1></div></div></div><div className="tables-count"><QrCode size={17} /><b>{tables.length}</b><span>QR-кодов меню</span></div></header><section className="tables-main"><div className="tables-intro"><div><h2>Меню для каждого стола</h2><p>QR-код открывает только меню ресторана с уже выбранным номером стола. Заказы и служебные разделы гостю недоступны.</p></div>{loading && <span className="tables-loading">Синхронизация…</span>}</div><div className="table-grid">{tables.map((table) => <article className="qr-card" key={table.id}><div className="qr-card-head"><div><span className="qr-label">TABLE</span><h3>{table.number}</h3></div><span className="table-active"><i /> Активен</span></div><div className="qr-box"><QRCodeSVG value={menuUrl(table)} size={154} level="M" includeMargin /></div><p className="qr-url">/menu/coffee-house?table={table.number}</p><div className="qr-actions"><a href={menuUrl(table)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Открыть меню</a><button onClick={() => printTable(table)}><Printer size={14} /> Печать QR</button></div></article>)}</div></section></main>;
}
