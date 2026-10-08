import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RequestMeta } from '../../../shared/application/audit.js';
import { ProblemDetailsDto } from '../../../shared/interface/problem-details.dto.js';
import { StrictThrottle } from '../../../shared/interface/throttling.js';
import { StaffAuthUseCases, type StaffActor } from '../application/staff-auth.use-cases.js';
import { StaffUsersUseCases } from '../application/staff-users.use-cases.js';
import {
  ChangePasswordDto,
  CreateStaffUserDto,
  EnrollmentConfirmDto,
  EnrollmentStartDto,
  LoginResponseDto,
  MfaEnrollmentResponseDto,
  MfaVerifyDto,
  RefreshDto,
  SessionTokensResponseDto,
  StaffLoginDto,
  TotpCodeDto,
  UpdateStaffUserDto,
} from './auth.dto.js';
import { CurrentStaff, ReqMeta, StaffAuth } from './staff-auth.guard.js';

/**
 * Autenticación del staff del backoffice. Pensada para el BFF (servidor Next): los tokens
 * viajan en el cuerpo/cabecera Authorization entre servidores y NUNCA llegan al navegador.
 */
@ApiTags('auth (staff)')
@Controller('auth/staff')
export class StaffAuthController {
  constructor(@Inject(StaffAuthUseCases) private readonly auth: StaffAuthUseCases) {}

  @Post('login')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Paso 1: correo + contraseña. Devuelve un desafío de MFA (verificar o enrolar). Nunca devuelve tokens de sesión.' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-credentials (genérico: no revela si el correo existe)' })
  @ApiForbiddenResponse({ type: ProblemDetailsDto, description: 'account-disabled' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto, description: 'account-locked (Retry-After) o límite por IP' })
  async login(@Body() body: StaffLoginDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.login(body, meta) };
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Paso 2: código TOTP (o de recuperación). Crea la sesión: access + refresh.' })
  @ApiOkResponse({ type: SessionTokensResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-mfa-token, invalid-mfa-code' })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto, description: 'account-locked' })
  async verifyMfa(@Body() body: MfaVerifyDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.verifyMfa(body, meta) };
  }

  @Post('mfa/enrollment')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Enrolamiento obligatorio (1/2): genera el secreto TOTP y la URI otpauth:// para el QR.' })
  @ApiOkResponse({ type: MfaEnrollmentResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-mfa-token' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'mfa-already-enrolled' })
  async startEnrollment(@Body() body: EnrollmentStartDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.startEnrollment(body, meta) };
  }

  @Post('mfa/enrollment/confirm')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Enrolamiento (2/2): confirma con un código TOTP. Devuelve la sesión y los códigos de recuperación (una sola vez).' })
  @ApiOkResponse({ type: SessionTokensResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-mfa-token, invalid-mfa-code' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'mfa-already-enrolled, mfa-enrollment-not-started' })
  async confirmEnrollment(@Body() body: EnrollmentConfirmDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.confirmEnrollment(body, meta) };
  }

  @Post('refresh')
  @HttpCode(200)
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Rota el refresh token (uso único). Reusar un refresh ya rotado revoca TODA la sesión (refresh-token-reused). El BFF debe serializar los refresh de una misma sesión.',
  })
  @ApiOkResponse({ type: SessionTokensResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto, description: 'invalid-refresh-token, refresh-token-expired, refresh-token-reused' })
  async refresh(@Body() body: RefreshDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.refresh(body, meta) };
  }

  @Post('logout')
  @HttpCode(204)
  @StaffAuth()
  @ApiOperation({ summary: 'Cierra la sesión actual (revoca su familia de refresh tokens).' })
  @ApiNoContentResponse()
  async logout(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta) {
    await this.auth.logout(actor, meta);
  }

  @Post('logout-all')
  @HttpCode(200)
  @StaffAuth()
  @ApiOperation({ summary: 'Cierra TODAS las sesiones del usuario (incluida la actual).' })
  async logoutAll(@CurrentStaff() actor: StaffActor, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.logoutAll(actor, meta) };
  }

  @Get('me')
  @StaffAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Perfil, rol y permisos efectivos (para armar el menú del backoffice).' })
  async me(@CurrentStaff() actor: StaffActor) {
    return { data: await this.auth.me(actor) };
  }

  @Get('sessions')
  @StaffAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sesiones activas del usuario.' })
  async sessions(@CurrentStaff() actor: StaffActor) {
    return { data: await this.auth.listSessions(actor) };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @StaffAuth()
  @ApiOperation({ summary: 'Cierra una sesión propia (404 si no existe o es de otro usuario).' })
  async revokeSession(@CurrentStaff() actor: StaffActor, @Param('sessionId', new ParseUUIDPipe()) sessionId: string, @ReqMeta() meta: RequestMeta) {
    await this.auth.revokeSession(actor, sessionId, meta);
  }

  @Post('mfa/recovery-codes')
  @HttpCode(200)
  @StaffAuth()
  @StrictThrottle()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Regenera los códigos de recuperación (exige un TOTP vigente). Los anteriores dejan de servir.' })
  async regenerateRecoveryCodes(@CurrentStaff() actor: StaffActor, @Body() body: TotpCodeDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.auth.regenerateRecoveryCodes(actor, body.code, meta) };
  }

  @Post('password')
  @HttpCode(204)
  @StaffAuth()
  @StrictThrottle()
  @ApiOperation({ summary: 'Cambia la contraseña (cierra las demás sesiones del usuario).' })
  @ApiBadRequestResponse({ type: ProblemDetailsDto, description: 'weak-password, password-unchanged' })
  async changePassword(@CurrentStaff() actor: StaffActor, @Body() body: ChangePasswordDto, @ReqMeta() meta: RequestMeta) {
    await this.auth.changePassword(actor, body, meta);
  }
}

/** Usuarios del staff (solo `users:manage`). */
@ApiTags('admin: usuarios del staff')
@Controller('admin/users')
@StaffAuth('users:manage')
export class StaffUsersController {
  constructor(@Inject(StaffUsersUseCases) private readonly users: StaffUsersUseCases) {}

  @Get()
  @ApiOperation({ summary: 'Lista de usuarios del staff.' })
  async list() {
    return { data: await this.users.list() };
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.users.get(id) };
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Crea un usuario con contraseña temporal (se devuelve UNA vez en `temporaryPassword`). Debe enrolar MFA al ingresar.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'staff-email-taken' })
  async create(@CurrentStaff() actor: StaffActor, @Body() body: CreateStaffUserDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.create(body, actor, meta) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambia rol, estado o nombre (bloqueo optimista con `version`). No permite quitar el último admin ni modificar el propio acceso.' })
  @ApiConflictResponse({ type: ProblemDetailsDto, description: 'concurrency-conflict, last-admin' })
  async update(@CurrentStaff() actor: StaffActor, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateStaffUserDto, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.update(actor, id, body, meta) };
  }

  @Post(':id/reset-mfa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reinicia el segundo factor (re-enrolamiento obligatorio) y cierra sus sesiones.' })
  async resetMfa(@CurrentStaff() actor: StaffActor, @Param('id', new ParseUUIDPipe()) id: string, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.resetMfa(actor, id, meta) };
  }

  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(@CurrentStaff() actor: StaffActor, @Param('id', new ParseUUIDPipe()) id: string, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.unlock(actor, id, meta) };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  async revokeSessions(@CurrentStaff() actor: StaffActor, @Param('id', new ParseUUIDPipe()) id: string, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.revokeSessions(actor, id, meta) };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Genera una contraseña temporal (se devuelve UNA vez) y cierra sus sesiones.' })
  async resetPassword(@CurrentStaff() actor: StaffActor, @Param('id', new ParseUUIDPipe()) id: string, @ReqMeta() meta: RequestMeta) {
    return { data: await this.users.resetPassword(actor, id, meta) };
  }
}
