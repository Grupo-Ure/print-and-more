// The provider's two halves, built from the function's environment. Each is
// built once, when its function starts, so a missing secret shows on deploy
// rather than on the first send or report.
//
// EMAIL_DRY_RUN=true swaps the transport for the dry-run stand-in and needs no
// provider secret. The report reader is the provider's in every environment:
// the e2e suite posts reports signed the provider's way, so a dry run still
// verifies them.

import { dryRunTransport, type ProviderSettings, type ReportReader, type Transport } from './emailProvider.ts'
import { createReportReader, createTransport } from './emailProviders/active.ts'

function settingsFor(functionName: string): ProviderSettings {
  return {
    required(name) {
      const value = Deno.env.get(name)
      if (!value) throw new Error(`${functionName}: ${name} is not set`)
      return value
    },
    optional(name) {
      return Deno.env.get(name) || undefined
    },
  }
}

export function transportFromEnv(functionName: string): Transport {
  return Deno.env.get('EMAIL_DRY_RUN') === 'true' ? dryRunTransport : createTransport(settingsFor(functionName))
}

export function reportReaderFromEnv(functionName: string): ReportReader {
  return createReportReader(settingsFor(functionName))
}
