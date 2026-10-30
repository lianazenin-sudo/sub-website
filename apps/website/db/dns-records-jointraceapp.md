# jointraceapp.com DNS records (captured 2026-10-30)

The domain's nameservers are `ns1.vercel-dns.com` / `ns2.vercel-dns.com`, so DNS
is managed in Vercel → Domains → jointraceapp.com → DNS Records. These email records
existed under Namecheap and must exist in Vercel DNS too.

| Name | Type | Value | Priority | Used by |
|---|---|---|---|---|
| `@` | MX | `mx1.privateemail.com` | 10 | Namecheap Private Email inbox |
| `@` | MX | `mx2.privateemail.com` | 10 | Namecheap Private Email inbox |
| `@` | TXT | `v=spf1 include:spf.privateemail.com ~all` | | SPF for Private Email |
| `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC49M6BIxzhC81PGgU7e1f0BILxrleKqo3JMTI/MCHYhJJRSwhFLMXRQWWGFMmYlxpQjjwWbshjPxU0CjySRrRiiG7rsL1/IQYc7d3AzXC0FhA46245laYtSz6kKZJaUsP/iQU26O+HIO7jCNUgtcou9tgxxEp4sNT+aHDuT5cfsQIDAQAB` | | Resend DKIM (public key) |
| `send` | CNAME | `send.forge.rmta.net` | | Resend bounce/SPF subdomain |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | | DMARC |

The website records (`@` and `www`) are created by Vercel automatically.
