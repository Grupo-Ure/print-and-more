// The provider in use. Changing provider is writing its file beside this one
// against ../emailProvider.ts and pointing this line at it; send-email,
// email-webhook and the e2e suite import the provider only through here.
export { createReportReader, createTransport, encodeReport } from './ahasend.ts'
