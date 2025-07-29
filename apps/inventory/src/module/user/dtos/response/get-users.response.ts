import { ApiProperty } from '@nestjs/swagger';

export class GetUsersResponse {
  @ApiProperty()
  public count: number;

  @ApiProperty()
  public rows: Record<string, any>;

  public static toLegacyResponse(count: number, rows: Record<any, any>[]): GetUsersResponse {
    return {
      count: count,
      rows: rows.map((row) => ({
        id: row.id,
        ['user_login']: row.loginId,
        ['user_role']: row.role,
        ['card_number']: row.cardNumber,
        ['employee_id']: row.employeeId,
        ['created_at']: row.createdAt,
        ['updated_at']: row.updatedAt,
      })),
    };
  }
}
