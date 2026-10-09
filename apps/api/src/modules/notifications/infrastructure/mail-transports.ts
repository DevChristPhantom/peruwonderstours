import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import type { MailTransport, OutgoingEmail } from '../application/mail-transport.js';

function toNodemailer(message: OutgoingEmail) {
  return {
    from: message.from,
    to: message.to.join(', '),
    replyTo: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
    messageId: message.messageId,
    headers: { 'X-PWT-Template': message.template, 'Auto-Submitted': 'auto-generated' },
    attachments: message.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  };
}

/**
 * Desarrollo: escribe cada correo como `.eml` (RFC 5322) en MAIL_OUTBOX_DIR (gitignored).
 * Se abre con cualquier cliente de correo para revisar el resultado.
 */
export class FileMailTransport implements MailTransport {
  readonly kind = 'file';
  private readonly transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });

  constructor(private readonly directory: string) {}

  async send(message: OutgoingEmail): Promise<{ transportRef: string }> {
    const info = await this.transporter.sendMail(toNodemailer(message));
    const dir = resolve(this.directory);
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = `${stamp}-${message.template}-${message.messageId.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 60)}.eml`;
    await writeFile(join(dir, file), info.message as Buffer);
    return { transportRef: `file:${file}` };
  }
}

/** Producción: SMTP con TLS obligatorio (STARTTLS en 587 o TLS implícito en 465). */
export class SmtpMailTransport implements MailTransport {
  readonly kind = 'smtp';
  private readonly transporter;

  constructor(options: { host: string; port: number; secure: boolean; user?: string; password?: string }) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      requireTLS: !options.secure,
      auth: options.user ? { user: options.user, pass: options.password ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: OutgoingEmail): Promise<{ transportRef: string }> {
    const info = await this.transporter.sendMail(toNodemailer(message));
    return { transportRef: `smtp:${String(info.response ?? info.messageId).slice(0, 280)}` };
  }
}

/** Pruebas: guarda los correos en memoria; puede simular fallos. */
export class MemoryMailTransport implements MailTransport {
  readonly kind = 'memory';
  readonly sent: OutgoingEmail[] = [];
  /** Cantidad de envíos que fallarán antes de volver a funcionar. */
  failNext = 0;

  send(message: OutgoingEmail): Promise<{ transportRef: string }> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(new Error('SMTP simulado: 451 servicio no disponible'));
    }
    this.sent.push(message);
    return Promise.resolve({ transportRef: `memory:${this.sent.length}` });
  }
}

/** Correo deshabilitado: el relay no arranca y los eventos quedan pendientes. */
export class DisabledMailTransport implements MailTransport {
  readonly kind = 'disabled';
  send(): Promise<{ transportRef: string }> {
    return Promise.reject(new Error('Correo deshabilitado (MAIL_TRANSPORT=disabled).'));
  }
}
