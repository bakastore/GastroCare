import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  // Minimal strength floor for synthetic v1 — not a production password policy.
  @IsString()
  @MinLength(10)
  newPassword: string;
}
