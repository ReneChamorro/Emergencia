import { useState } from "react";

/**
 * Booleano respaldado por localStorage (persiste entre sesiones en el mismo
 * dispositivo). Usado para recordar que el usuario ya respondio un ajuste
 * cuyo valor "sin configurar" es indistinguible de una respuesta valida
 * (ej. "sin limite"), asi que no se puede derivar solo de los datos.
 */
export function useLocalFlag(key: string | null, initial: boolean) {
  const [value, setValue] = useState(() => {
    if (!key) return initial;
    try {
      return localStorage.getItem(key) === "1" || initial;
    } catch {
      return initial;
    }
  });

  function set(v: boolean) {
    setValue(v);
    if (!key) return;
    try {
      if (v) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {
      // Storage no disponible (modo privado, cuota, etc): no bloquea la UI.
    }
  }

  return [value, set] as const;
}
