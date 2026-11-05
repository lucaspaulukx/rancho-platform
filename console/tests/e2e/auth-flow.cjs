const KEYCLOAK_ORIGIN = 'http://localhost:18081';
// Wait for the trusted provider before locating fields shared with the local form.
async function openKeycloakLogin(page) {
  await page.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
  await page.waitForURL((url) => url.origin === KEYCLOAK_ORIGIN);
  await page.locator('input[name="username"]').waitFor();
}
module.exports = { openKeycloakLogin };
