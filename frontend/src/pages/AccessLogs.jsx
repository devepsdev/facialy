import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Download, Search, X } from "lucide-react";
import client, { errorMessage } from "../api/client";
import { Avatar, Button, Card, EmptyState, PageShell, REASON_LABEL, ResultBadge, Spinner, cx, inputClass, useToast } from "../components/ui";

const PAGE_SIZE = 20;
const RESULTS = [
  { key: "", label: "Todos" },
  { key: "GRANTED", label: "Concedidos" },
  { key: "DENIED", label: "Denegados" },
  { key: "UNKNOWN", label: "Desconocidos" },
];

const dateFmt = (iso) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const timeFmt = (iso) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AccessLogs() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useCallback(() => ({ result: result || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, q: q || undefined }), [result, dateFrom, dateTo, q]);

  useEffect(() => {
    client.get("access-logs/", { params: { ...filters(), page, page_size: PAGE_SIZE } })
      .then((r) => { setRows(r.data.results); setCount(r.data.count); })
      .catch((e) => { toast.error(errorMessage(e)); setRows([]); });
  }, [filters, page, toast]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await client.get("access-logs/export/", { params: filters(), responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement("a"), { href: url, download: `accesos-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo exportar."));
    }
    setExporting(false);
  };

  const hasFilters = result || dateFrom || dateTo || search;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <PageShell
      title="Registro de accesos"
      subtitle={`${count.toLocaleString("es-ES")} eventos${hasFilters ? " con los filtros aplicados" : ""}.`}
      actions={<Button variant="secondary" onClick={exportCsv} loading={exporting}><Download className="size-4" /> Exportar CSV</Button>}
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
          <input className={inputClass + " pl-10"} placeholder="Buscar empleado…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar empleado" />
        </div>
        <div className="flex gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
          {RESULTS.map((r) => (
            <button key={r.key} onClick={() => { setResult(r.key); setPage(1); }} className={cx("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", result === r.key ? "bg-white/12 text-white" : "text-slate-400 hover:text-white")}>{r.label}</button>
          ))}
        </div>
        <label className="text-xs text-slate-400">Desde<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputClass + " mt-1 block w-40 scheme-dark"} /></label>
        <label className="text-xs text-slate-400">Hasta<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputClass + " mt-1 block w-40 scheme-dark"} /></label>
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setResult(""); setDateFrom(""); setDateTo(""); setSearch(""); setPage(1); }}><X className="size-3.5" /> Limpiar</Button>}
      </div>

      <Card className="overflow-hidden">
        {rows === null ? (
          <div className="flex justify-center py-24"><Spinner className="size-8" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin eventos" text={hasFilters ? "Ningún acceso coincide con los filtros." : "Cuando alguien pase por el kiosco aparecerá aquí."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs tracking-wider text-slate-500 uppercase">
                  <th className="px-5 py-3.5 font-medium">Fecha</th>
                  <th className="px-5 py-3.5 font-medium">Empleado</th>
                  <th className="px-5 py-3.5 font-medium">Resultado</th>
                  <th className="px-5 py-3.5 font-medium">Similitud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-white/3">
                    <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-slate-200">{dateFmt(l.timestamp)}</span> <span className="ml-1 font-mono text-xs text-slate-500">{timeFmt(l.timestamp)}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.employee_name} size="sm" />
                        <div><p className="text-slate-100">{l.employee_name}</p>{l.department && <p className="text-xs text-slate-500">{l.department}</p>}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><div className="flex flex-wrap items-center gap-2"><ResultBadge result={l.result} />{l.reason && <span className="text-xs text-slate-500">{REASON_LABEL[l.reason]}</span>}</div></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-20 rounded-full bg-white/8"><div className={cx("h-full rounded-full", l.result === "UNKNOWN" ? "bg-amber-400" : "bg-cyan-400")} style={{ width: `${Math.min(l.confidence, 1) * 100}%` }} /></div>
                        <span className="font-mono text-xs text-slate-400 tabular-nums">{l.confidence.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-400">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          Página {page} de {pages}
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      )}
    </PageShell>
  );
}
