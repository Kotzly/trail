export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type EmailProvider = {
  send(message: EmailMessage): Promise<void>;
};
