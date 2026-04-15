export interface ISmsProvider {
  name: string;
  send(to: string, message: string): Promise<string>; // Returns provider message ID
}
