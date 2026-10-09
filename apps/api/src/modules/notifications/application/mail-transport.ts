/** Correo listo para entregar al transporte (SMTP, archivo .eml o memoria). */
export interface OutgoingEmail {
  template: string;
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Message-ID determinista `<outboxId.template@dominio>` (dedupe en el receptor). */
  messageId: string;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType: string }>;
}

export interface MailTransport {
  readonly kind: 'file' | 'smtp' | 'memory' | 'disabled';
  send(message: OutgoingEmail): Promise<{ transportRef: string }>;
}
