# Troubleshooting and Recovery

## Campaign does not open

1. Reopen the Directive launcher.
2. Check host story permissions and whether creation is allowed.
3. Retry `Start Campaign`.
4. Refresh and reopen the host story.

## Projection appears empty or stale

1. Open Settings.
2. Confirm active campaign projection and authority state.
3. Refresh the view.
4. Reopen the chat from host and check again.

## Mission objective seems wrong

1. Confirm the mission page is the same active chat.
2. Check if a branch or reroll created a new continuation.
3. Verify no one changed the mission from another active branch.
4. Continue in the correct continuation and let the settlement settle.

## Recovery pattern

Do not hand-edit JSON state files.
Use host-supported recovery and Directive-supported diagnostics paths.

If you suspect a broken lineage:

- stop editing the current message
- refresh Directive and the host chat
- open settings and run storage verification
- choose a supported host recovery path if available

## When to escalate

If recovery loops repeat, capture:

- host and extension version
- campaign package id
- exact reproduction steps
- error text from verification screens

Open a support request with that bundle.

