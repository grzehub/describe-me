/** The steps the arrange phase took, next to the steps Vitest takes, for `pnpm check-live` to compare. */
export function OrderLog({ steps, expected }: { steps: string[]; expected: string[] }) {
  return (
    <section>
      <h2>Steps</h2>
      <ol aria-label="steps">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <h2>Expected</h2>
      <ol aria-label="expected steps">
        {expected.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  )
}
