/** The values of one `each` or `for` row, so each row shows what it got. */
export function Row({ values }: { values: unknown[] }) {
  return <p className="row">{JSON.stringify(values)}</p>
}
