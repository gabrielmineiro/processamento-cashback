export abstract class OrdersRepository {
  abstract query(query: string, params?: any[]): Promise<any>;
}
