import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import { PERMISSIONS, STAFF_ROLES } from '../domain/permissions.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StaffLoginDto {
  @ApiProperty({ example: 'operaciones@peruwonderstours.com' })
  @Transform(trim)
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: 'password' })
  @IsString()
  @Length(1, 128)
  password: string;
}

export class MfaVerifyDto {
  @ApiProperty({ description: '`mfaToken` devuelto por POST /auth/staff/login (5 min).' })
  @IsString()
  @Length(20, 2048)
  mfaToken: string;

  @ApiProperty({ example: '123456', description: 'Código TOTP de 6 dígitos o código de recuperación `XXXXX-XXXXX`.' })
  @IsString()
  @Length(6, 16)
  code: string;
}

export class EnrollmentStartDto {
  @ApiProperty({ description: '`enrollmentToken` devuelto por POST /auth/staff/login (5 min).' })
  @IsString()
  @Length(20, 2048)
  enrollmentToken: string;
}

export class EnrollmentConfirmDto extends EnrollmentStartDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'El código debe tener 6 dígitos.' })
  code: string;
}

/** H-14: primer ingreso con contraseña temporal. */
export class InitialPasswordDto {
  @ApiProperty({ description: '`passwordChangeToken` devuelto por POST /auth/staff/login (5 min).' })
  @IsString()
  @Length(20, 2048)
  passwordChangeToken: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token opaco (43 caracteres base64url). Se rota en cada uso.' })
  @IsString()
  @Length(43, 43)
  refreshToken: string;
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'El código debe tener 6 dígitos.' })
  code: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword: string;
}

// --- Respuestas (documentación OpenAPI) ---
export class StaffProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ enum: STAFF_ROLES }) role: string;
  @ApiProperty({ enum: PERMISSIONS, isArray: true }) permissions: string[];
  @ApiProperty() mfaEnabled: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastLoginAt: string | null;
}

export class LoginResponseDataDto {
  @ApiProperty({ enum: ['mfa_required', 'mfa_enrollment_required', 'password_change_required'] }) status: string;
  @ApiPropertyOptional({ description: 'Si status = password_change_required (H-14): enviar a POST /auth/staff/password/initial.' }) passwordChangeToken?: string;
  @ApiPropertyOptional({ description: 'Si status = mfa_required: enviar a POST /auth/staff/mfa/verify.' }) mfaToken?: string;
  @ApiPropertyOptional({ description: 'Si status = mfa_enrollment_required: enviar a /auth/staff/mfa/enrollment/*.' }) enrollmentToken?: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: string;
}
export class LoginResponseDto {
  @ApiProperty({ type: LoginResponseDataDto }) data: LoginResponseDataDto;
}

export class SessionTokensDataDto {
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ description: 'JWT de acceso (10-15 min). Cabecera Authorization: Bearer <token>.' }) accessToken: string;
  @ApiProperty({ format: 'date-time' }) accessTokenExpiresAt: string;
  @ApiProperty({ description: 'Refresh token opaco. Guardarlo SOLO en el servidor del BFF (cookie httpOnly cifrada).' }) refreshToken: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt: string;
  @ApiProperty({ description: 'Id de la sesión (familia de refresh tokens).' }) sessionId: string;
  @ApiProperty({ type: StaffProfileDto }) user: StaffProfileDto;
  @ApiPropertyOptional({ type: [String], description: 'Solo al confirmar el enrolamiento: códigos de recuperación (se muestran UNA vez).' })
  recoveryCodes?: string[];
  @ApiPropertyOptional({ description: 'Solo en mfa/verify: códigos de recuperación sin usar.' }) recoveryCodesRemaining?: number;
}
export class SessionTokensResponseDto {
  @ApiProperty({ type: SessionTokensDataDto }) data: SessionTokensDataDto;
}

export class MfaEnrollmentDataDto {
  @ApiProperty({ example: 'otpauth://totp/peruwonderstours:ana%40example.com?secret=...&issuer=...', description: 'Renderizar como QR en el BFF.' })
  otpauthUri: string;
  @ApiProperty({ description: 'Secreto base32 para ingreso manual. No almacenar ni registrar.' }) secret: string;
  @ApiProperty() issuer: string;
  @ApiProperty() label: string;
}
export class MfaEnrollmentResponseDto {
  @ApiProperty({ type: MfaEnrollmentDataDto }) data: MfaEnrollmentDataDto;
}

// --- Gestión de usuarios del staff ---
export class CreateStaffUserDto {
  @ApiProperty()
  @Transform(trim)
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 3, maxLength: 160 })
  @Transform(trim)
  @IsString()
  @Length(3, 160)
  fullName: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES)
  role: (typeof STAFF_ROLES)[number];
}

export class UpdateStaffUserDto {
  @ApiProperty({ description: 'Versión leída (bloqueo optimista).' })
  @IsInt()
  @Min(0)
  version: number;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: (typeof STAFF_ROLES)[number];

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'suspended', 'disabled'])
  status?: 'active' | 'suspended' | 'disabled';

  @ApiPropertyOptional({ minLength: 3, maxLength: 160 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 160)
  fullName?: string;
}
