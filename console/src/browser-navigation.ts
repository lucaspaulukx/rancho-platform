/** Full navigation for provider flows; router navigation remains internal to the app. */
export function navigateBrowser(url: string) {
  location.assign(url);
}
