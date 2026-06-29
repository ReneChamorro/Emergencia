import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfessionals } from "@/hooks/useProfessionals";
import type { Case, CaseStatus, Profile, Urgency } from "@/types/database";
import {
  STATUS_BADGE,
  STATUS_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  URGENCY_ORDER,
  formatDateTime,
} from "@/lib/domain";
import { StaffLayout } from "@/components/StaffLayout";
import { CaseDetailDialog } from "@/components/coordinator/CaseDetailDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FullPageSpinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Inbox, RefreshCw, Search } from "lucide-react";

export default function Coordinador() {
  const { professionals } = useProfessionals();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Case | null>(null);

  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | "todas">("todas");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "todos">("todos");

  const profMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of professionals) m.set(p.id, p);
    return m;
  }, [professionals]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    setCases((data as Case[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases
      .filter((c) => urgencyFilter === "todas" || c.urgency === urgencyFilter)
      .filter((c) => statusFilter === "todos" || c.status === statusFilter)
      .filter(
        (c) =>
          !q ||
          c.patient_name.toLowerCase().includes(q) ||
          (c.city ?? "").toLowerCase().includes(q) ||
          c.whatsapp.includes(q)
      )
      .sort((a, b) => {
        const u = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
        if (u !== 0) return u;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [cases, search, urgencyFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      nuevos: cases.filter((c) => c.status === "nuevo").length,
      altos: cases.filter((c) => c.urgency === "alta").length,
      abiertos: cases.filter(
        (c) => c.status !== "cerrado" && c.status !== "derivado"
      ).length,
    }),
    [cases]
  );

  if (loading) return <FullPageSpinner label="Cargando casos..." />;

  return (
    <StaffLayout
      title="Bandeja de casos"
      subtitle="Revisa, prioriza y asigna las solicitudes de apoyo."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
      }
    >
      {/* Resumen */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Casos nuevos" value={stats.nuevos} icon={<Inbox />} />
        <StatCard
          label="Urgencia alta"
          value={stats.altos}
          icon={<AlertTriangle />}
          danger
        />
        <StatCard label="Casos abiertos" value={stats.abiertos} />
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, ciudad o WhatsApp"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={urgencyFilter}
            onValueChange={(v) => setUrgencyFilter(v as Urgency | "todas")}
          >
            <SelectTrigger className="sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda urgencia</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CaseStatus | "todos")}
          >
            <SelectTrigger className="sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo estado</SelectItem>
              <SelectItem value="nuevo">Nuevo</SelectItem>
              <SelectItem value="asignado">Asignado</SelectItem>
              <SelectItem value="en_contacto">En contacto</SelectItem>
              <SelectItem value="cerrado">Cerrado</SelectItem>
              <SelectItem value="derivado">Derivado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay casos que coincidan con los filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Urgencia</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Profesional</th>
                  <th className="px-4 py-3 font-medium">Recibido</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const highRisk = c.in_danger || c.self_harm_ideation;
                  const prof = c.assigned_professional_id
                    ? profMap.get(c.assigned_professional_id)
                    : null;
                  return (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onClick={() => setSelected(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(c);
                        }
                      }}
                      className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          {highRisk && (
                            <AlertTriangle
                              className="size-4 text-destructive"
                              aria-label="Riesgo alto"
                            />
                          )}
                          {c.patient_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.city ?? "—"} · {c.whatsapp}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={URGENCY_BADGE[c.urgency]}>
                          {URGENCY_LABEL[c.urgency]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_BADGE[c.status]}>
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {prof?.full_name ?? "Sin asignar"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(c.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CaseDetailDialog
        caseItem={selected}
        professionals={professionals}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSaved={() => void load()}
      />
    </StaffLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={
              "text-2xl font-bold tabular-nums " +
              (danger ? "text-destructive" : "text-foreground")
            }
          >
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={
              "flex size-10 items-center justify-center rounded-full " +
              (danger
                ? "bg-destructive/10 text-destructive"
                : "bg-accent/10 text-accent")
            }
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
