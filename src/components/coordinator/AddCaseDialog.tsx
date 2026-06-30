import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { manualCaseSchema, LIMITS } from "@/lib/validation";
import type { Urgency } from "@/types/database";
import { URGENCY_LABEL } from "@/lib/domain";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = {
  patient_name: "",
  whatsapp: "",
  city: "",
  urgency: "media" as Urgency,
  observations: "",
  consent: false,
};

export function AddCaseDialog({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError(null);
    onClose();
  }

  async function handleSave() {
    setError(null);
    const parsed = manualCaseSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    setSaving(true);
    const d = parsed.data;
    const { error: err } = await supabase.from("cases").insert({
      patient_name: d.patient_name,
      whatsapp: d.whatsapp,
      city: d.city,
      urgency: d.urgency,
      preferred_modality: "cualquiera",
      observations: d.observations,
      consent: true,
      status: "nuevo",
    });
    setSaving(false);

    if (err) {
      setError("No se pudo registrar el caso. Intenta de nuevo.");
      return;
    }
    onSaved();
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar caso</DialogTitle>
          <DialogDescription>
            Para pacientes que llamaron o escribieron directamente, sin pasar por
            el formulario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ac-name">Nombre y apellido *</Label>
            <Input
              id="ac-name"
              value={form.patient_name}
              onChange={(e) => update("patient_name", e.target.value)}
              maxLength={LIMITS.name}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-whatsapp">WhatsApp *</Label>
            <Input
              id="ac-whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="+58 412 1234567"
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              maxLength={LIMITS.whatsapp}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-city">Ciudad (opcional)</Label>
              <Input
                id="ac-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                maxLength={LIMITS.city}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Urgencia</Label>
              <Select value={form.urgency} onValueChange={(v) => update("urgency", v as Urgency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["alta", "media", "baja"] as Urgency[]).map((u) => (
                    <SelectItem key={u} value={u}>{URGENCY_LABEL[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-notes">Observaciones (opcional)</Label>
            <Textarea
              id="ac-notes"
              value={form.observations}
              onChange={(e) => update("observations", e.target.value)}
              placeholder="Detalles relevantes de la llamada..."
              maxLength={LIMITS.observations}
              className="min-h-[72px]"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => update("consent", e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--accent))]"
            />
            <span className="text-sm text-foreground">
              Confirmo que el paciente autorizó ser contactado por un profesional
              voluntario del programa.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.consent}>
            {saving && <Spinner className="text-primary-foreground" />}
            Crear caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
