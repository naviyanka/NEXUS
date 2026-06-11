# ADR 002: Adopt Microsoft.AspNetCore.Authentication.Negotiate

**Date:** 2024-06-11
**Status:** Accepted

## Context
NEXUS requires transparent authentication for domain users accessing the web hub. The original plan involved manually writing Kerberos and NTLM middleware.

## Decision
We will use the official `Microsoft.AspNetCore.Authentication.Negotiate` NuGet package.

## Consequences
**Positive:**
- Turns a multi-week custom security implementation into a single line of DI registration (`builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)`).
- Highly secure and maintained by Microsoft.

**Negative:**
- Abstracted complexity; troubleshooting SPN or Kerberos delegation issues relies on standard Microsoft documentation rather than custom code logging.
