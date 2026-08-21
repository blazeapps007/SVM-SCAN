// Cosmos SDK's standard `auth` module (not steembridge-specific, but exposed
// on the same chain LCD as STEEMBRIDGE_LCD_URL) — used here only to resolve
// module account addresses (fee_collector, bridge_reward, steemblackhole,
// ...) to their human-readable names. Module account addresses are derived
// deterministically from the module name (authtypes.NewModuleAddress), not
// human-chosen, so they otherwise show up in transaction events as bare
// bech32 addresses with no indication of what they are.

import { withTimeout } from './withTimeout'

interface RawModuleAccount {
  base_account: { address: string }
  name: string
}

// GET /cosmos/auth/v1beta1/module_accounts — every module account this
// chain has, in one call. Response shape verified live against a real node.
export async function fetchModuleAccountNames(
  lcdUrl: string
): Promise<Map<string, string>> {
  const url = `${lcdUrl}/cosmos/auth/v1beta1/module_accounts`
  const response = await withTimeout(fetch(url), 'auth:module_accounts')
  if (!response.ok) {
    throw new Error(`auth module_accounts failed: HTTP ${response.status}`)
  }
  const json = (await response.json()) as { accounts: RawModuleAccount[] }
  return new Map(json.accounts.map((a) => [a.base_account.address, a.name]))
}
