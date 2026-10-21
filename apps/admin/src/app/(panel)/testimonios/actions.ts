"use server";

import { apiData } from "@/lib/api/client";
import type { Testimonial } from "@/lib/api/content-types";
import { action } from "@/lib/auth/guard";
import { formObject, invalidResult, moderationNoteSchema, rejectNoteSchema, testimonialEditSchema } from "@/lib/schemas/content";

/** Moderación de testimonios (permiso `content:publish`; editar: `content:write`). Todo queda auditado. */

const UUID = /^[0-9a-f-]{36}$/i;

function path(id: string, suffix = ""): string {
  if (!UUID.test(id)) throw new Error("Id de testimonio inválido");
  return `/admin/testimonials/${id}${suffix}`;
}

export async function approveTestimonialAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = moderationNoteSchema.safeParse(formObject(fd, ["note"]));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<Testimonial>(path(id, "/approve"), { method: "POST", body: parsed.data.note ? { note: parsed.data.note } : {} }).then(() => null), {
    message: "Testimonio aprobado: ya puede mostrarse en el sitio.",
  });
}

export async function rejectTestimonialAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = rejectNoteSchema.safeParse(formObject(fd, ["note"]));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<Testimonial>(path(id, "/reject"), { method: "POST", body: { note: parsed.data.note } }).then(() => null), { message: "Testimonio rechazado." });
}

export async function featureTestimonialAction(id: string, featured: boolean, _prev: unknown, _fd: FormData) {
  return action(() => apiData<Testimonial>(path(id, "/feature"), { method: "POST", body: { featured } }).then(() => null), {
    message: featured ? "Marcado como destacado." : "Ya no es destacado.",
  });
}

export async function updateTestimonialAction(id: string, _prev: unknown, fd: FormData) {
  const parsed = testimonialEditSchema.safeParse(formObject(fd, ["authorName", "authorCountry", "body", "rating", "locale"]));
  if (!parsed.success) return invalidResult(parsed.error);
  return action(() => apiData<Testimonial>(path(id), { method: "PATCH", body: parsed.data }).then(() => null), { message: "Cambios guardados." });
}

export async function deleteTestimonialAction(id: string, _prev: unknown, _fd: FormData) {
  return action(() => apiData<null>(path(id), { method: "DELETE" }).then(() => null), { message: "Testimonio eliminado." });
}
