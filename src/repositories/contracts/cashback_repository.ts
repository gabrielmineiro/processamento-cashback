
export abstract class CashbackRepository  {
  abstract query(email: string): Promise<any>;
  
}
