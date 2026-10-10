"use server";

import { apiData } from "@/lib/api/client";
import { action } from "@/lib/auth/guard";
import { CONTACT_STATUS } from "@/lib/content";
import { contactStatusSchema, formObject, invalidResult } from "@/lib/schemas/content";

const UUID = /^[0-9a-f-]{36}$/i;

/** Cambio de estado de un mensaje con nota interna opcional (`contact:manage`, auditado). */
export async function setContactStatusAction(id: string, _prev: unknown, fd: FormData) {
  if (!UUID.test(id)) throw new Error("Id de mensaje inválido");
  const parsed = contactStatusSchema.safeParse(formObject(fd, ["status", "internalNote"]));
  if (!parsed.success) return invalidResult(parsed.error);
  const { status, internalNote } = parsed.data;
  return action(
    () =>
      apiData<{ id: string; status: string }>(`/admin/contact-messages/${id}/status`, {
        method: "POST",
        // La nota reemplaza la anterior: el formulario la precarga, así que vacía = borrarla.
        body: { status, internalNote },
      }).then(() => null),
    { message: `Mensaje actualizado: ${CONTACT_STATUS[status]?.label.toLowerCase() ?? status}.` },
  );
}
