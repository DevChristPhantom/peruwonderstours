import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
const origin = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3102";
if (process.env.CI !== "true" || process.env.MAIL_TRANSPORT !== "memory"
  || new URL(process.env.DATABASE_URL ?? "").pathname !== "/pwt_browser_test"
  || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
  throw new Error("Staff management tests require fresh isolated CI database and memory mail.");
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")].map((char) => {
    const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid fixture TOTP secret");
    return index.toString(2).padStart(5, "0");
  }).join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

test("admin users: create own staff fixture, update, unlock, revoke sessions, reset and disable", async ({ page, browser }, info) => {
  test.setTimeout(150000);
  const suffix = Date.now().toString();
  const fullName = `CI Staff Only ${suffix}`;
  const email = `staff-own-${suffix}@peruwonderstours.test`;
  const metrics: { action: string; milliseconds: number }[] = [];
  async function measured(action: string, work: () => Promise<void>) {
    const start = performance.now(); await test.step(action, work);
    metrics.push({ action, milliseconds: Math.round(performance.now() - start) });
  }
  try {
    await measured("Authenticate fresh fixture administrator", async () => {
      expect(process.env.E2E_ADMIN_EMAIL).toBe("browser-admin@peruwonderstours.test");
      await page.goto(`${origin}/login`);
      await page.getByLabel(/^Correo\s*\*?$/).fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel(/^Contraseña\s*\*?$/).fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
      // RFC 6238 replay protection: another serial suite may have used this step.
      const previousStep = Math.floor(Date.now() / 30000);
      await expect.poll(() => Math.floor(Date.now() / 30000), { timeout: 35000, intervals: [250] }).toBeGreaterThan(previousStep);
      await page.getByLabel("Código de 6 dígitos").fill(totp(process.env.E2E_ADMIN_TOTP_SECRET!));
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/`);
    });
    await measured("Create unique sales staff user through actual form", async () => {
      await page.goto(`${origin}/usuarios`);
      await expect(page.getByRole("article", { name: fullName, exact: true })).toHaveCount(0);
      const create = page.locator("#nuevo form");
      await create.getByLabel(/^Nombre completo\s*\*?$/).fill(fullName);
      await create.getByLabel(/^Correo\s*\*?$/).fill(email);
      await create.getByLabel(/^Rol\s*\*?$/).selectOption("agent");
      await create.getByRole("button", { name: "Crear usuario", exact: true }).click();
      const row = page.getByRole("article", { name: fullName, exact: true });
      await expect(row).toContainText(email);
      await expect(row.getByText("MFA pendiente", { exact: true })).toBeVisible();
      // Never read, attach or print the generated temporary password.
      await expect(create.getByRole("status")).toContainText(`Contraseña temporal de ${email}`);
      await page.reload();
      await expect(page.getByRole("article", { name: fullName, exact: true })).toContainText(email);
    });
    const own = () => page.getByRole("article", { name: fullName, exact: true });
    await measured("Update only newly created user role and verify persistence", async () => {
      await own().locator('select[name="role"]').selectOption("operator");
      await own().getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: "Usuario actualizado." })).toBeVisible();
      await page.reload();
      await expect(own().locator('select[name="role"]')).toHaveValue("operator");
    });
    await measured("Record own user failed login and unlock through admin", async () => {
      const isolated = await browser.newContext();
      try {
        const login = await isolated.newPage();
        await login.goto(`${origin}/login`);
        await login.getByLabel(/^Correo\s*\*?$/).fill(email);
        await login.getByLabel(/^Contraseña\s*\*?$/).fill("Intentionally-Wrong-CI-Only!");
        await login.getByRole("button", { name: "Continuar", exact: true }).click();
        await expect(login.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" })).toBeVisible();
      } finally { await isolated.close(); }
      await page.reload();
      await expect(own().getByText("1 intentos fallidos", { exact: true })).toBeVisible();
      await own().getByRole("button", { name: "Desbloquear", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: "Cuenta desbloqueada." })).toBeVisible();
      await page.reload();
      await expect(own().getByRole("button", { name: "Desbloquear", exact: true })).toHaveCount(0);
      await expect(own().getByText(/intentos fallidos/)).toHaveCount(0);
    });
    await measured("Revoke own user sessions and reset MFA", async () => {
      page.once("dialog", (dialog) => dialog.accept());
      await own().getByRole("button", { name: "Cerrar sesiones", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: "Sesiones cerradas." })).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await own().getByRole("button", { name: "Reiniciar MFA", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: "Segundo factor reiniciado" })).toBeVisible();
      await page.reload();
      await expect(own().getByText("MFA pendiente", { exact: true })).toBeVisible();
    });
    await measured("Generate new temporary credential only for own user", async () => {
      page.once("dialog", (dialog) => dialog.accept());
      await own().getByRole("button", { name: "Nueva contraseña temporal", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: `Contraseña temporal de ${email}` })).toBeVisible();
      await page.reload();
      await expect(own().getByRole("status")).toHaveCount(0);
    });
    await measured("Disable own staff fixture and verify persisted status", async () => {
      await own().locator('select[name="status"]').selectOption("disabled");
      await own().getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(own().getByRole("status").filter({ hasText: "Usuario actualizado." })).toBeVisible();
      await page.reload();
      await expect(own().locator('select[name="status"]')).toHaveValue("disabled");
      await expect(own().locator("span").filter({ hasText: /^Deshabilitado$/ })).toBeVisible();
      await expect(page.getByRole("article", { name: "Browser CI Administrator" })).toContainText("MFA activo");
    });
  } finally {
    await info.attach("admin-user-action-timings.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  }
});


