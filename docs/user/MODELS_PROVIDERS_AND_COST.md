# Models, Providers, and Cost

Directive does not own provider keys.

## What you control in host

Your Sonder host controls:

- model selection
- provider endpoint
- token budgets and quotas
- sampling policy and per-chat model choices

Directive only consumes host-provided model context for settlement work where required.

## How prompts work

Model instructions for normal narration come from your host.
Directive adds authored campaign context only for mission and progression checks.
It does not replace your host model settings.

## Cost notes

You can reduce cost by:

- keeping turns focused
- staying in smaller generation modes when available in your host
- avoiding unnecessary narrative reset loops
- respecting host-side provider rate limits

Cost and latency are host-provider dependent, so results vary by host setup.

