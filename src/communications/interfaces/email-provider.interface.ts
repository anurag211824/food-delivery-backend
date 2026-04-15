export interface IEmailProvider {
  name: string;
  send(to: string, subject: string, html: string): Promise<string>; // Returns provider message ID
}
