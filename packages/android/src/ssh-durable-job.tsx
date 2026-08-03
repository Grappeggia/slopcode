import { Show } from "solid-js"
import { remoteJobStatusLabel, type RemoteJob } from "./remote-jobs"
import { SshShell } from "./ssh-shell"

type Props = {
  job: RemoteJob
  onContinue: () => void
}

export function SshDurableJob(props: Props) {
  return (
    <SshShell>
      <main data-ssh-durable-job class="min-h-screen bg-surface-base p-4 pt-20 text-text-strong sm:p-6 sm:pt-20">
        <section class="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-border-weak-base bg-surface-raised-base p-4 sm:p-6">
          <header class="flex flex-col gap-2">
            <p class="text-12-regular uppercase tracking-wide text-text-weak">Durable remote job</p>
            <h1 class="text-20-medium">Remote session available</h1>
            <p class="text-14-regular text-text-weak">
              This saved job remains available for recovery. It is not an SSH PTY session, so the app will not pretend to resume it through the native terminal.
            </p>
          </header>

          <section class="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Durable remote job details">
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
              <p class="text-12-regular text-text-weak">Status</p>
              <p data-ssh-durable-job-status class="mt-1 text-14-medium">{remoteJobStatusLabel(props.job.status)}</p>
            </div>
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
              <p class="text-12-regular text-text-weak">Session</p>
              <p data-ssh-durable-job-session class="mt-1 break-all text-14-medium">{props.job.sessionID}</p>
            </div>
            <div class="rounded-xl border border-border-weak-base bg-surface-base p-3 sm:col-span-2">
              <p class="text-12-regular text-text-weak">Workspace</p>
              <p class="mt-1 break-all text-14-medium">{props.job.directory}</p>
            </div>
          </section>

          <Show when={props.job.error}>
            <p role="alert" class="rounded-xl border border-border-critical-base bg-surface-critical-weak p-3 text-14-regular">
              {props.job.error}
            </p>
          </Show>

          <Show when={props.job.output}>
            <section class="rounded-xl border border-border-weak-base bg-surface-base p-3" aria-label="Saved job output">
              <p class="text-12-regular text-text-weak">Saved output</p>
              <pre class="mt-2 whitespace-pre-wrap break-words text-12-regular">{props.job.output}</pre>
            </section>
          </Show>

          <button
            type="button"
            data-ssh-durable-job-continue
            onClick={props.onContinue}
            class="min-h-12 w-fit rounded-md border border-border-weak-base px-4 py-3 text-12-medium"
          >
            Choose SSH workspace
          </button>
        </section>
      </main>
    </SshShell>
  )
}
