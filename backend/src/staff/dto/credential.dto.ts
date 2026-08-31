import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StaffCredentialType } from '@prisma/client';

export class CreateCredentialDto {
  @IsEnum(StaffCredentialType)
  credentialType: StaffCredentialType;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  credentialNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuingOrganization?: string | null;

  @IsOptional()
  @IsString()
  issueDate?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateCredentialDto {
  @IsOptional()
  @IsEnum(StaffCredentialType)
  credentialType?: StaffCredentialType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  credentialNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuingOrganization?: string | null;

  @IsOptional()
  @IsString()
  issueDate?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  /** Stored status only: ACTIVE | REVOKED. EXPIRED is derived, never set. */
  @IsOptional()
  @IsIn(['ACTIVE', 'REVOKED'])
  status?: 'ACTIVE' | 'REVOKED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
