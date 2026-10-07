import type { Metadata } from "next";

import { PendingContentPage } from "@/components/layout/PendingContentPage";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Condiciones de pago",
  description: "Condiciones de pago, saldo y cancelación de Peru Wonders Tours.",
  path: "/es/politicas/condiciones-de-pago",
});

/** Resumen de las condiciones que el cliente publica hoy (brain/wiki/negocio/reglas-reserva-y-pago.md). */
export default function PaymentTermsPage() {
  return (
    <PendingContentPage
      title="Condiciones de pago"
      path="/es/politicas/condiciones-de-pago"
      notice="Resumen de las condiciones publicadas en el sitio actual. El texto definitivo (penalidades por tramo y plazos exactos) está pendiente de validación con la agencia y cumplimiento."
    >
      <ul className="list-disc space-y-2 pl-5">
        <li>Para reservar se paga el 50 % del total.</li>
        <li>El saldo se paga al menos 7 días antes del servicio.</li>
        <li>Los tours que incluyen boletos de terceros (tren, ingreso a Machu Picchu) se pagan completos al reservar.</li>
        <li>
          Cancelaciones con un mínimo de 20 días hábiles de anticipación: se descuentan los gastos operativos de los
          servicios ya emitidos.
        </li>
        <li>Cancelaciones con pocos días de anticipación o servicios no usados: sin devolución.</li>
        <li>Tickets de tren, ingreso a Machu Picchu y sobrevuelos no son reembolsables una vez emitidos.</li>
        <li>Los cambios están sujetos a disponibilidad y a penalidad.</li>
      </ul>
    </PendingContentPage>
  );
}
